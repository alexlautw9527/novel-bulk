import { describe, expect, it } from 'vitest';
import { formatProgress } from '../src/cli/progress';

describe('formatProgress', () => {
  it('依比例填滿進度條並顯示百分比與筆數', () => {
    // Arrange + Act：10 章完成 5 章，條寬 10
    const line = formatProgress({ done: 5, total: 10, failed: 0 }, 10);

    // Assert
    expect(line).toBe('[█████░░░░░]  50% 5/10');
  });

  it('有失敗章節時附上失敗數', () => {
    // Arrange + Act + Assert
    expect(formatProgress({ done: 10, total: 10, failed: 2 }, 10)).toBe('[██████████] 100% 10/10 失敗 2');
  });

  it('total 為 0 時不除以零', () => {
    // Arrange + Act + Assert
    expect(formatProgress({ done: 0, total: 0, failed: 0 }, 10)).toBe('[░░░░░░░░░░]   0% 0/0');
  });
});
