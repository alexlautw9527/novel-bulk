import * as OpenCC from 'opencc-js';
import type { ConvertMode } from './options';

// 建立轉換器要載入字典，延後到第一次使用並重複利用
const converters = new Map<string, (text: string) => string>();

function converterFor(mode: Exclude<ConvertMode, 'none'>) {
  let conv = converters.get(mode);
  if (!conv) {
    conv = OpenCC.Converter({ from: 'cn', to: mode === 's2t' ? 'tw' : 'twp' });
    converters.set(mode, conv);
  }
  return conv;
}

export function convertText(text: string, mode: ConvertMode): string {
  return mode === 'none' ? text : converterFor(mode)(text);
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
}
