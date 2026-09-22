/**
 * Frontend performance telemetry cross-cutting facility. Log persistence is injected
 * via setPerformanceLogSink by the app-feedback-log service at module load; this
 * module depends on no service.
 */

export interface PerformanceFields {
  [key: string]: number | string | boolean | null | undefined;
}

export interface PerformanceLogEntry {
  level: 'debug';
  code: null;
  message: string;
  path: null;
  line: null;
}

type PerformanceLogSink = (entry: PerformanceLogEntry) => void;

let logSink: PerformanceLogSink = () => {};

export function setPerformanceLogSink(sink: PerformanceLogSink): void {
  logSink = sink;
}

export function measurePerformance<T>(name: string, fields: PerformanceFields, action: () => T): T {
  const startedAt = performance.now();
  try {
    return action();
  } finally {
    recordPerformance(name, performance.now() - startedAt, fields);
  }
}

export async function measurePerformanceAsync<T>(name: string, fields: PerformanceFields, action: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    return await action();
  } finally {
    recordPerformance(name, performance.now() - startedAt, fields);
  }
}

export function recordPerformance(name: string, ms: number, fields: PerformanceFields = {}): void {
  const suffix = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${sanitizePerformanceValue(String(value))}`)
    .join(' ');
  logSink({
    level: 'debug',
    code: null,
    message: `PERF ${name} ms=${Math.round(ms)}${suffix ? ` ${suffix}` : ''}`,
    path: null,
    line: null,
  });
}

function sanitizePerformanceValue(value: string): string {
  return value.replace(/[\r\n\t]/g, ' ').trim();
}
