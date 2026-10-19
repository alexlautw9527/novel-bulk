# novel-bulk

從小說網站的目錄頁抓取所有章節，輸出成 epub。提供命令列與本機 web GUI 兩種使用方式。

支援網站：

- czbooks.net
- xbanxia.cc

## 安裝

```bash
npm install
```

需要 Node.js 22 以上（程式使用 `process.loadEnvFile`）。

## 命令列

所有指令都透過 `npm run cli --` 執行，`--` 之後的內容會傳給 novel-bulk。

```bash
# 抓取並輸出 epub
npm run cli -- build <目錄頁網址> [選項]

# 補抓失敗章節並重新輸出（已快取的章節不會重抓）
npm run cli -- retry <目錄頁網址> [選項]

# 啟動 local web gui（預設 http://127.0.0.1:3000）
npm run cli -- serve [--port 3000]

# 顯示用法
npm run cli -- --help
```

`build` 結束時若有章節抓取失敗，程式以 exit code 1 結束，並列出失敗章節。重新執行 `retry` 只會補抓這些章節。

範例：

```bash
# 只輸出第 1 至 100 章
npm run cli -- build https://czbooks.net/n/xxxxx --from 1 --to 100

# 不縮排、不分組、不加封面
npm run cli -- build https://czbooks.net/n/xxxxx --indent 0 --group-size 0 --no-cover
```

### 選項

| 選項 | 說明 | 預設值 |
| --- | --- | --- |
| `--from N` `--to M` | 只輸出第 N 至 M 章 | 全部 |
| `--out DIR` | 輸出資料夾 | `output` |
| `--cache DIR` | 快取資料夾 | `.cache` |
| `--refresh` | 忽略快取重新下載 | 關閉 |
| `--indent N` | 首行縮排字元數 | `2` |
| `--line-height X` | 行距倍數 | 沿用閱讀器 |
| `--paragraph-spacing none\|half\|full` | 段落間距 | `half` |
| `--title-align center\|left` | 章節標題對齊 | `center` |
| `--no-page-break` | 章節標題前不強制換頁 | 換頁 |
| `--font NAME` | 指定 font-family（不內嵌字型檔） | 沿用閱讀器 |
| `--no-cover` | 不加封面 | 加封面 |
| `--no-summary` | 不加簡介頁 | 加簡介頁 |
| `--convert none\|s2t\|s2twp` | 簡繁轉換：不轉換、簡轉繁、簡轉繁並轉換台灣慣用詞 | `s2t` |
| `--group-size N` | 目錄每組章數，`0` 代表不分組 | `100` |
| `--config FILE` | 設定檔路徑 | `./novel-bulk.config.json` |

### 設定檔

在執行指令的目錄放置 `novel-bulk.config.json`，可預先設定排版選項。鍵名同排版選項的駝峰寫法，另外支援 `out`、`from`、`to`。命令列選項的優先順序高於設定檔。

```json
{
  "indent": 2,
  "paragraphSpacing": "half",
  "convert": "s2twp",
  "out": "output"
}
```

### 環境變數

在專案根目錄建立 `.env`，啟動時會自動載入（檔案不存在時略過）。

| 變數 | 說明 |
| --- | --- |
| `CZ_COOKIE` | 抓取 czbooks.net 時附上的 Cookie |
| `CZ_UA` | 抓取 czbooks.net 時使用的 User-Agent |

## Web GUI

```bash
npm run build:web          # 第一次使用前先建置前端
npm run cli -- serve       # 啟動後開啟 http://127.0.0.1:3000
```

伺服器只綁定 `127.0.0.1`，不對區域網路開放。

開發前端時另開兩個終端機：

```bash
npm run cli -- serve       # 後端，port 3000
npm run dev:web            # Vite dev server，/api 會轉發到後端
```

## 開發

```bash
npm test                   # 執行測試（vitest）
npm run typecheck          # 型別檢查
```

## 目錄結構

- `bin/`：`novel-bulk` 執行檔入口
- `src/cli/`：命令列參數解析與進度顯示
- `src/core/`：抓取、章節整理、epub 產生；`sites/` 放各網站的解析器
- `src/server/`：web GUI 的 API 與靜態檔伺服器
- `src/web/`：web GUI 前端（React）
- `output/`：epub 輸出位置
- `.cache/`：章節快取
