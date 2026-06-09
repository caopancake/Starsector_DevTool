export const APP_LOG_LEVELS = ['info', 'warning', 'error'] as const;
export type AppLogLevel = (typeof APP_LOG_LEVELS)[number];

export interface AppLogEntry {
  level: AppLogLevel;
  message: string;
  path: string | null;
  line: number | null;
}

export interface AppLogStatus {
  path: string;
  sizeBytes: number;
}
