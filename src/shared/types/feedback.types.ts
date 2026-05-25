import type { VNodeChild } from 'vue';

export interface ConfirmOptions {
  title: string;
  content?: string | (() => VNodeChild);
  actionText: string;
  onConfirm: () => void | Promise<void>;
}

export interface AppFeedback {
  success(message: string): void;
  info(message: string): void;
  warning(message: string): void;
  error(error: unknown, contextMessage?: string): void;
  confirmDanger(options: ConfirmOptions): void;
  confirmWarning(options: ConfirmOptions): void;
}
