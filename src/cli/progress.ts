export interface FetchProgress {
  done: number;
  total: number;
  failed: number;
}

export function formatProgress({ done, total, failed }: FetchProgress, width = 30): string {
  const ratio = total === 0 ? 0 : done / total;
  const filled = Math.round(ratio * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const pct = String(Math.round(ratio * 100)).padStart(3, ' ');
  return `[${bar}] ${pct}% ${done}/${total}${failed > 0 ? ` 失敗 ${failed}` : ''}`;
}
