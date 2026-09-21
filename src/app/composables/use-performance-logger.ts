import { measurePerformance, type PerformanceFields } from '@/shared/runtime/performance';

export function usePerformanceLogger() {
  return {
    measure<T>(name: string, fields: PerformanceFields, action: () => T): T {
      return measurePerformance(name, fields, action);
    },
  };
}
