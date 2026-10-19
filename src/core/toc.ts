import type { ChapterRef } from './types';

export interface ChapterGroup {
  /** null 代表不分組 */
  title: string | null;
  chapters: ChapterRef[];
}

export function groupChapters(chapters: ChapterRef[], size: number): ChapterGroup[] {
  if (size <= 0) return [{ title: null, chapters }];
  const groups: ChapterGroup[] = [];
  for (let i = 0; i < chapters.length; i += size) {
    const slice = chapters.slice(i, i + size);
    const first = i + 1;
    const last = i + slice.length;
    groups.push({
      title: first === last ? `第 ${first} 章` : `第 ${first} 至 ${last} 章`,
      chapters: slice,
    });
  }
  return groups;
}
