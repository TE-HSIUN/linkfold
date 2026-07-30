## Why

Linkfold 後端已能建立與轉址短網址，但目前缺少一般使用者可操作的前端，也尚未支援參考畫面要求的自訂短碼、頁面資訊擷取與啟用狀態。現在需要補齊一條可在桌機與手機完成「輸入網址、設定選項、建立、複製分享」的產品主線，並以最小後端擴充確保畫面上的功能都是真實可用。

## What Changes

- 建立 JavaScript 版 Vue 3 + Vite 前端，使用 Tailwind CSS、Vue Router 與 Axios，提供現代響應式的單頁短網址建立流程。
- 表單支援原始網址、選填自訂短碼、選填密碼、最多 500 字元備註、取得頁面資訊與啟用狀態，並提供完整驗證、載入、錯誤及成功結果狀態。
- 擴充建立短網址 API，接受選填自訂短碼與啟用狀態，回傳啟用狀態，並區分格式錯誤、保留路徑與短碼衝突。
- 新增安全的頁面 metadata 擷取 API，取得目標網頁標題與描述供前端預填備註，且擷取失敗不阻擋建立流程。
- 為 Link 資料新增預設啟用狀態；停用連結在造訪與解鎖時一律視為不存在。
- 調整受密碼保護短網址的伺服器解鎖頁，讓表單在視窗中置中，並沿用建立頁的背景、卡片、字體、欄位與按鈕視覺語言。
- 新增前後端自動化測試與響應式、鍵盤操作及真實 API 串接驗收。

## Capabilities

### New Capabilities

- `link-creation-ui`: 使用者透過響應式 Vue 表單設定連結、建立短網址、查看結果並複製或開啟短網址。
- `page-metadata`: 後端安全擷取公開 HTTP/HTTPS 網頁的標題與描述，供建立表單預填備註。

### Modified Capabilities

- `link-creation`: 建立 API 新增選填自訂短碼與啟用狀態，並回傳對應結果與明確錯誤。
- `link-redirection`: 停用連結在一般造訪及密碼解鎖時回傳與未知短碼相同的 404，且啟用中的受保護連結提供置中並與建立頁一致的密碼表單。

## Impact

- Affected specs: link-creation-ui、page-metadata、link-creation、link-redirection
- Affected APIs: POST /api/links、POST /api/page-metadata、GET /:code、POST /:code/unlock
- Affected dependencies: Vue 3、Vite、Tailwind CSS、Vue Router、Axios、Vitest、Vue Test Utils，以及後端 HTML metadata parser
- Affected code:
  - New:
    - frontend/
    - backend/src/routes/page-metadata.js
    - backend/test/page-metadata.test.js
    - backend/prisma/migrations/
  - Modified:
    - backend/prisma/schema.prisma
    - backend/src/app.js
    - backend/src/routes/links.js
    - backend/src/routes/redirect.js
    - backend/test/links.test.js
    - backend/test/redirect.test.js
    - backend/README.md
  - Removed: none
