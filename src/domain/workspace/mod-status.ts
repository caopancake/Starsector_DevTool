import type { ModEntry } from '@/shared/types';

export function modStatusLabel(status: ModEntry['status']): string {
  if (status === 'loading') return '加载中';
  if (status === 'ready') return '已加载';
  return '读取失败';
}
