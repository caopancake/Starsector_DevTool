import { h, type CSSProperties, type VNode } from 'vue';
import { NButton } from 'naive-ui/es/button';
import type { DialogApiInjection } from 'naive-ui/es/dialog/src/DialogProvider';
import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider';
import { NSpace } from 'naive-ui/es/space';
import { NText } from 'naive-ui/es/typography';
import {
  commandErrorCode,
  extractFileReferenceFromError,
  fileReferenceLocationSuffix,
  formatError,
  type FileReference,
} from '@/shared/lib/errors';
import { resolveFeedbackFileSession, type FeedbackFileSession } from '@/shared/lib/feedback-session';
import type { AppFeedback, ChooseOptions, ConfirmOptions } from '@/shared/types';
import { openFileEditorWindow } from '@/windows/file-editor.window';
import type { FileEditorContextSeverity } from '@/windows/window.events';
import { currentWindowSessionIdentity } from '@/windows/window-identity.window';
import { recordLogBestEffort } from '@/services/app-feedback-log.service';
import { useSettingsStore } from '@/stores/settings.store';
import { useProjectStore } from '@/stores/project.store';
import { closestRootForPath } from '@/shared/lib/paths';

type ToastLevel = 'success' | 'info' | 'warning' | 'error';

interface ToastContext {
  contextLabel: string;
  contextSeverity: FileEditorContextSeverity;
  buttonType: 'default' | 'success' | 'warning' | 'error';
}

const TOAST_CONTEXT: Record<ToastLevel, ToastContext> = {
  success: { contextLabel: '信息', contextSeverity: 'info', buttonType: 'success' },
  info: { contextLabel: '信息', contextSeverity: 'info', buttonType: 'default' },
  warning: { contextLabel: '警告', contextSeverity: 'warning', buttonType: 'warning' },
  error: { contextLabel: '错误', contextSeverity: 'error', buttonType: 'error' },
};

const TOAST_TEXT_STYLE: CSSProperties = { maxWidth: '680px', overflowWrap: 'anywhere' };

export function createAppFeedback(message: MessageApiInjection, dialog: DialogApiInjection): AppFeedback {
  return {
    success: (text) => {
      showToast(message, 'success', text);
    },
    info: (text) => {
      showToast(message, 'info', text);
    },
    warning: (text, code) => {
      const reference = showToast(message, 'warning', text);
      recordLogBestEffort({
        level: 'warning',
        code: code ?? 'ui.warning',
        message: null,
        path: reference?.path ?? null,
        line: reference?.line ?? null,
      });
    },
    error: (error, contextMessage) => {
      const text = contextMessage ? `${contextMessage}：${formatError(error)}` : formatError(error);
      const reference = showToast(message, 'error', text);
      recordLogBestEffort({
        level: 'error',
        code: commandErrorCode(error) ?? 'unknown',
        message: null,
        path: reference?.path ?? null,
        line: reference?.line ?? null,
      });
    },
    confirmDanger: (options) => showConfirm(dialog, 'error', options),
    confirmWarning: (options) => showConfirm(dialog, 'warning', options),
    choose: (options) => showChoose(dialog, options),
  };
}

function showConfirm(dialog: DialogApiInjection, type: 'error' | 'warning', options: ConfirmOptions) {
  dialog[type]({
    title: options.title,
    content: options.content,
    positiveText: options.actionText,
    negativeText: '取消',
    onPositiveClick: () => options.onConfirm(),
  });
}

function showToast(message: MessageApiInjection, level: ToastLevel, text: string): FileReference | null {
  const reference = extractFileReferenceFromError(text);
  const session = reference === null ? null : resolveSessionForPath(reference.path);
  const content = () => renderToastContent(level, text, reference, session);
  // Error toasts stay open until closed manually: naive-ui skips the
  // auto-close timer entirely when duration is 0. Other levels inherit the
  // provider baseline (10s, closable, keep-alive-on-hover).
  if (level === 'error') message.error(content, { duration: 0 });
  else if (level === 'warning') message.warning(content);
  else if (level === 'info') message.info(content);
  else message.success(content);
  return reference;
}

function resolveSessionForPath(path: string): FeedbackFileSession | null {
  const project = useProjectStore();
  const modRoot = closestRootForPath(project.manifests.keys(), path);
  const sessionId = modRoot === null ? null : project.getSessionId(modRoot);
  return resolveFeedbackFileSession(modRoot, sessionId, currentWindowSessionIdentity(), path);
}

function renderToastContent(level: ToastLevel, text: string, reference: FileReference | null, session: FeedbackFileSession | null): VNode {
  const rows: VNode[] = [h('span', { style: TOAST_TEXT_STYLE }, text)];
  if (reference !== null) {
    const locationText = fileReferenceText(reference);
    rows.push(h(NText, { depth: 3, style: TOAST_TEXT_STYLE }, { default: () => locationText }));
  }
  if (reference !== null && session !== null) {
    const openRequest = { reference, session, level };
    rows.push(
      h(
        NButton,
        {
          size: 'tiny',
          type: TOAST_CONTEXT[level].buttonType,
          secondary: true,
          onClick: () => openReferenceInEditor(openRequest.reference, openRequest.session, openRequest.level),
        },
        { default: () => '打开文件' },
      ),
    );
  }
  return h(NSpace, { vertical: true, size: 'small', wrap: false, align: 'start' }, { default: () => rows });
}

function fileReferenceText(reference: FileReference): string {
  return reference.line ? `${reference.path}（${fileReferenceLocationSuffix(reference.line, reference.column)}）` : reference.path;
}

function openReferenceInEditor(reference: FileReference, session: FeedbackFileSession, level: ToastLevel): Promise<void> {
  const context = TOAST_CONTEXT[level];
  return openFileEditorWindow({
    modRoot: session.modRoot,
    path: reference.path,
    sessionId: session.sessionId,
    line: reference.line,
    column: reference.column,
    settings: useSettingsStore().settingsSnapshot(),
    title: '文件编辑器',
    contextLabel: context.contextLabel,
    contextSeverity: context.contextSeverity,
    message: reference.message,
  }).catch((error) => {
    recordLogBestEffort({
      level: 'error',
      code: commandErrorCode(error) ?? 'unknown',
      message: 'error file open failed',
      path: null,
      line: null,
    });
  });
}

function showChoose(dialog: DialogApiInjection, options: ChooseOptions): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const instance = dialog.create({
      type: 'info',
      title: options.title,
      content: options.content,
      closable: true,
      showIcon: false,
      action: () =>
        h(
          NSpace,
          { justify: 'end', size: 'small' },
          {
            default: () => [
              ...options.choices.map((choice) =>
                h(
                  NButton,
                  {
                    type: choice.type ?? 'default',
                    size: 'small',
                    onClick: () => {
                      resolved = true;
                      instance.destroy();
                      resolve(choice.value);
                    },
                  },
                  { default: () => choice.label },
                ),
              ),
              h(
                NButton,
                {
                  size: 'small',
                  onClick: () => {
                    resolved = true;
                    instance.destroy();
                    resolve(null);
                  },
                },
                { default: () => '取消' },
              ),
            ],
          },
        ),
      onClose: () => {
        if (!resolved) resolve(null);
      },
      onMaskClick: () => {
        if (!resolved) {
          resolved = true;
          instance.destroy();
          resolve(null);
        }
      },
    });
  });
}
