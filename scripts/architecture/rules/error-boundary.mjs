import { frontendFile } from '../shared/files.mjs';

export const errorBoundaryRule = {
  name: 'error-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      const isErrorSurface = file.rel.startsWith('src/services/') || file.rel.startsWith('src/orchestrators/');
      if (!isErrorSurface) continue;
      // service/orchestrator 的失败语义必须携带 action（AppError/withCause）；
      // 裸 Error 仅允许在 domain 表达值语义。
      if (/throw\s+new\s+Error\s*\(/.test(file.text)) {
        failures.push(`${file.rel}: service/orchestrator failures must throw AppError with an action, not a bare Error`);
      }
    }
    return failures;
  },
};
