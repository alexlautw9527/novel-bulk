import { describe, expect, it } from 'vitest';
import { convertText, sanitizeFilename } from '../src/core/text';

describe('convertText', () => {
  it('none 保留原文', () => {
    // Arrange + Act + Assert：含簡體字的句子不變
    expect(convertText('一只貓頭鷹', 'none')).toBe('一只貓頭鷹');
  });

  it('s2t 只轉字形：簡體殘留變正體，詞彙不替換', () => {
    // Arrange：混有簡體字形與中國用語「軟件」
    // Act + Assert：字形被轉換，「軟件」維持原樣
    expect(convertText('心态 软件', 's2t')).toBe('心態 軟件');
  });

  it('s2twp 同時替換台灣慣用詞彙', () => {
    // Arrange + Act + Assert：「软件」變成「軟體」
    expect(convertText('软件', 's2twp')).toBe('軟體');
  });
});

describe('sanitizeFilename', () => {
  it('取代路徑不合法字元並去掉首尾空白', () => {
    // Arrange + Act + Assert：斜線、冒號、問號被取代，全形標點保留
    expect(sanitizeFilename(' a/b:c?d ')).toBe('a_b_c_d');
    expect(sanitizeFilename('HP：最強魔藥收購商')).toBe('HP：最強魔藥收購商');
  });
});
