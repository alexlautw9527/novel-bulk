import { describe, expect, it } from 'vitest';
import { groupChapters } from '../src/core/toc';
import type { ChapterRef } from '../src/core/types';

const make = (n: number): ChapterRef[] =>
  Array.from({ length: n }, (_, i) => ({ index: i + 1, title: `c${i + 1}`, url: `u${i + 1}` }));

describe('groupChapters', () => {
  it('每 N 章一組，最後一組可以不滿', () => {
    // Arrange：5 章，每組 2 章
    const chapters = make(5);

    // Act：分組
    const groups = groupChapters(chapters, 2);

    // Assert：三組，標題標出章節順序範圍
    expect(groups.map((g) => g.chapters.length)).toEqual([2, 2, 1]);
    expect(groups.map((g) => g.title)).toEqual(['第 1 至 2 章', '第 3 至 4 章', '第 5 章']);
  });

  it('group size 為 0 時不分組，回傳單一沒有標題的組別', () => {
    // Arrange：3 章
    const chapters = make(3);

    // Act + Assert：單一組別、title 為 null
    const groups = groupChapters(chapters, 0);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBeNull();
    expect(groups[0]?.chapters).toHaveLength(3);
  });
});
