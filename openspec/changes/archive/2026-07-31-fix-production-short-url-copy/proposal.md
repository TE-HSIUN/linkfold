## Problem

正式站目前使用公開 IP 的 HTTP origin；使用者建立短網址後按下「複製短網址」，瀏覽器無法使用 Clipboard API，畫面只選取網址並顯示失敗，沒有完成一鍵複製。

## Root Cause

結果卡只呼叫 `navigator.clipboard.writeText()`。公開 HTTP origin 不提供這項 secure-context API，而現有失敗路徑只執行文字選取，沒有呼叫可在使用者點擊事件中工作的相容複製機制。本機 localhost 與 mock Clipboard API 的單元測試沒有覆蓋這個部署差異。

## Proposed Solution

保留單一「複製短網址」按鈕與 Clipboard API 主要路徑；當 API 不存在或寫入失敗時，選取現有短網址輸入框的完整內容並以 `document.execCommand('copy')` 嘗試相容複製。任一路徑成功都回報已複製，兩者都失敗才保留選取並提示手動複製。

## Non-Goals

- 不新增網域、HTTPS、Caddy 或其他部署架構。
- 不修改後端 API、資料庫、短網址內容或結果卡版面。
- 不移除標準 Clipboard API，也不新增第二個複製按鈕。

## Success Criteria

- 公開 HTTP 正式站的使用者按一次按鈕即可複製完整短網址。
- Clipboard API 可用時仍優先使用標準路徑。
- Clipboard API 與相容路徑都失敗時，短網址維持完整選取並顯示可操作的繁體中文手動複製提示。
- 前端測試分別覆蓋主要路徑、API 不存在、API 拒絕後 fallback 成功，以及所有路徑失敗。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `link-creation-ui`: 複製動作必須在 Clipboard API 不可用或拒絕時嘗試相容複製，只有所有自動複製路徑都失敗才要求手動複製。

## Impact

- Affected specs: `link-creation-ui`
- Affected code:
  - Modified: `frontend/src/components/LinkResultCard.vue`
  - Modified: `frontend/src/__tests__/CreateLinkView.test.js`
  - New: (none)
  - Removed: (none)
- Public APIs, dependencies, backend, database, and deployment configuration: unchanged
