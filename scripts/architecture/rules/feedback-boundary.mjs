import { frontendFile } from '../shared/files.mjs';
import { classifyFrontendPath } from '../shared/classify.mjs';
import { importedProjectPaths, importSpecifiers } from '../shared/imports.mjs';

export const feedbackBoundaryRule = {
  name: 'feedback-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const current = classifyFrontendPath(file.rel);
      if (current.layer === 'shared' && current.role === 'api' && mixesSettingsAndFeedbackLogCommands(file.text)) {
        failures.push(`${file.rel}: split app settings and feedback log APIs instead of using a mixed app config API`);
      }
      if (
        current.layer === 'shared' &&
        current.domain === 'types' &&
        !isTypeBarrel(file.text) &&
        mixesSettingsAndFeedbackLogTypes(file.text)
      ) {
        failures.push(`${file.rel}: app settings and app log wire types must live in separate shared type ownership files`);
      }
      if (current.layer === 'services' && current.domain === 'app-settings') {
        assertNoImportDomain(
          file,
          failures,
          { role: 'api', domain: 'app-feedback-log' },
          'app settings service must not import feedback/log API',
        );
      }
      if (current.layer === 'services' && current.domain === 'app-feedback-log') {
        assertNoImportDomain(
          file,
          failures,
          { role: 'api', domain: 'app-settings' },
          'app feedback log service must not import settings API',
        );
        assertNoImportDomain(
          file,
          failures,
          { layer: 'shared', domain: 'types', text: /\bAppSettings\b/ },
          'app feedback log service must use app log types, not settings types',
        );
      }
      for (const imported of importSpecifiers(file.text)) {
        if (imported.typeOnly || imported.specifier !== 'naive-ui') continue;
        if (/\b(useMessage|useDialog|createDiscreteApi)\b/.test(imported.importedName ?? '') && !isFeedbackBoundary(current)) {
          failures.push(`${file.rel}: message/dialog/discrete feedback must use the unified feedback boundary`);
        }
      }
      if (/\b(?:useMessage|useDialog|createDiscreteApi)\s*\(/.test(file.text) && !isFeedbackBoundary(current)) {
        failures.push(`${file.rel}: business code must not create feedback APIs directly`);
      }
    }
    return failures;
  },
};

function assertNoImportDomain(file, failures, forbiddenTarget, message) {
  for (const imported of importedProjectPaths(file)) {
    const target = classifyFrontendPath(imported.resolved);
    if (targetMatches(target, imported, forbiddenTarget)) failures.push(`${file.rel}: ${message}`);
  }
}

function targetMatches(target, imported, forbiddenTarget) {
  if (forbiddenTarget.layer && target.layer !== forbiddenTarget.layer) return false;
  if (forbiddenTarget.role && target.role !== forbiddenTarget.role) return false;
  if (forbiddenTarget.domain && target.domain !== forbiddenTarget.domain) return false;
  if (forbiddenTarget.text && !forbiddenTarget.text.test(imported.importedName ?? '')) return false;
  return true;
}

function mixesSettingsAndFeedbackLogCommands(text) {
  return (
    /\b(?:load_app_settings|save_app_settings)\b/.test(text) &&
    /\b(?:append_app_log|get_app_log_status|open_app_log_file|clear_app_log_file|open_config_dir|clear_config_files)\b/.test(text)
  );
}

function mixesSettingsAndFeedbackLogTypes(text) {
  return /\bAppSettings\b/.test(text) && /\b(?:APP_LOG_LEVELS|AppLogLevel|AppLogEntry|AppLogStatus)\b/.test(text);
}

function isTypeBarrel(text) {
  return !/\b(?:interface|type|const|enum)\s+[A-Za-z0-9_]+/.test(text);
}

function isFeedbackBoundary(current) {
  return current.layer === 'app' && current.domain === 'app-feedback';
}
