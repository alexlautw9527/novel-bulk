import { describe, expect, it } from 'vitest';
import { parseCli } from '../src/cli/args';

describe('parseCli', () => {
  it('build 的預設值：輸出到 output，使用預設排版', () => {
    // Arrange + Act
    const cmd = parseCli(['build', 'https://www.xbanxia.cc/books/1.html'], {});

    // Assert
    expect(cmd).toMatchObject({ name: 'build', url: 'https://www.xbanxia.cc/books/1.html' });
    if (cmd.name !== 'build') throw new Error('unreachable');
    expect(cmd.options.outDir).toBe('output');
    expect(cmd.options.layout).toEqual({});
  });

  it('命令列參數轉成排版選項與範圍', () => {
    // Arrange + Act
    const cmd = parseCli(
      ['build', 'u', '--from', '5', '--to', '9', '--indent', '3', '--group-size', '50', '--convert', 'none', '--no-cover', '--no-page-break'],
      {},
    );

    // Assert
    if (cmd.name !== 'build') throw new Error('unreachable');
    expect([cmd.options.from, cmd.options.to]).toEqual([5, 9]);
    expect(cmd.options.layout).toEqual({ indent: 3, groupSize: 50, convert: 'none', cover: false, pageBreak: false });
  });

  it('設定檔提供預設值，命令列參數優先', () => {
    // Arrange：設定檔縮排 1、行距 1.8
    const config = { indent: 1, lineHeight: 1.8 };

    // Act：命令列覆蓋縮排
    const cmd = parseCli(['build', 'u', '--indent', '2'], config);

    // Assert：縮排用命令列、其餘用設定檔
    if (cmd.name !== 'build') throw new Error('unreachable');
    expect(cmd.options.layout).toEqual({ indent: 2, lineHeight: 1.8 });
  });

  it('serve 預設 port 3000，可覆蓋', () => {
    // Arrange + Act + Assert
    expect(parseCli(['serve'], {})).toEqual({ name: 'serve', port: 3000 });
    expect(parseCli(['serve', '--port', '4000'], {})).toEqual({ name: 'serve', port: 4000 });
  });

  it('retry 與 build 參數相同', () => {
    // Arrange + Act + Assert
    expect(parseCli(['retry', 'u'], {}).name).toBe('retry');
  });

  it('缺少網址或未知指令時丟出錯誤', () => {
    // Arrange + Act + Assert
    expect(() => parseCli(['build'], {})).toThrow(/網址/);
    expect(() => parseCli(['nope'], {})).toThrow(/指令/);
    expect(() => parseCli(['build', 'u', '--convert', 'x'], {})).toThrow(/convert/);
  });
});
