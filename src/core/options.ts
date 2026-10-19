export type ConvertMode = 'none' | 's2t' | 's2twp';

export interface LayoutOptions {
  /** 首行縮排字元數 */
  indent: number;
  /** 行距倍數；null 沿用閱讀器預設 */
  lineHeight: number | null;
  paragraphSpacing: 'none' | 'half' | 'full';
  titleAlign: 'center' | 'left';
  /** 章節標題前強制換頁 */
  pageBreak: boolean;
  /** 只寫 font-family，不內嵌字型檔；null 沿用閱讀器字型 */
  fontFamily: string | null;
  cover: boolean;
  summaryPage: boolean;
  convert: ConvertMode;
  /** 目錄每組章數；0 代表不分組 */
  groupSize: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  indent: 2,
  lineHeight: null,
  paragraphSpacing: 'half',
  titleAlign: 'center',
  pageBreak: true,
  fontFamily: null,
  cover: true,
  summaryPage: true,
  convert: 's2t',
  groupSize: 100,
};
