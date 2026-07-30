## Context

Linkfold 目前只有 Express、Prisma 與 PostgreSQL 後端。既有 `POST /api/links` 可接收原始網址、備註與共享密碼並自動產生 7 碼短碼，`GET /:code` 與 `POST /:code/unlock` 負責轉址及伺服器產生的密碼頁；repo 尚無 `frontend/`。本變更要新增建立者使用的 Vue 單頁，並補上自訂短碼、頁面 metadata 與啟用狀態三項既有後端未提供的能力。

這是跨前端、HTTP API、資料模型與外部網路擷取的變更。前端使用 JavaScript，不導入 TypeScript；文件、介面文字與錯誤訊息使用繁體中文（台灣）。本機由 Vite 與 Express 分別執行，生產環境沿用 Nginx 同源提供靜態前端並代理 API 與短碼路由。

## Goals / Non-Goals

**Goals:**

- 提供從輸入、驗證、metadata 預填、建立到複製分享的完整響應式流程。
- 讓自訂短碼與啟用狀態成為後端持久化且可測試的正式契約。
- 讓頁面 metadata 擷取具有明確的 SSRF、逾時、回應類型、大小與重新導向邊界。
- 保持既有自動短碼、密碼雜湊與伺服器密碼頁行為相容。
- 讓伺服器密碼頁在不同視窗高度與寬度保持置中，並在不導入 Vue bundle 的前提下沿用首頁視覺語言。
- 以單元／元件／整合測試覆蓋前後端失敗路徑與資料邊界。

**Non-Goals:**

- 不做帳號、登入、短網址列表、編輯、刪除、點擊統計 UI 或重新啟用介面。
- 不將受保護短網址的解鎖表單改寫為 Vue 頁面；只調整既有伺服器 HTML 的版面與樣式。
- 不保存 metadata 為獨立資料欄位，不抓圖片、favicon、Open Graph 卡片或執行目標頁 JavaScript。
- 不導入 Pinia、SSR、Nuxt、TypeScript、前端本機歷史或離線功能。
- 不在本變更建立完整 Nginx、網域、TLS、GCP 或後端 Dockerfile 設定。

## Decisions

### JavaScript Vue 單頁與局部狀態

以官方 Vue + Vite 結構建立 `frontend/`，加入 Tailwind CSS Vite plugin、Vue Router、Axios、Vitest 與 Vue Test Utils。路由目前只有 `/` 的建立頁，但保留明確 router 入口以符合既定技術棧並支援後續頁面。建立頁拆成表單、成功結果與 API service；表單值、欄位錯誤、metadata 狀態、建立狀態與複製狀態都由頁面／子元件局部管理，不加入 Pinia。

替代方案是先建立全域 store，但本次沒有跨頁共享狀態，會增加同步與測試成本而沒有可觀察收益。

### 響應式表單與可存取回饋

桌機以原始網址為主欄，自訂短碼與密碼為較窄欄，備註與狀態控制占完整寬度；窄於 Tailwind `md` breakpoint 時全部改為單欄。所有輸入使用永久可見 label，錯誤文字以 `aria-describedby` 關聯，第一個無效欄位在送出後取得焦點；載入、metadata 結果與複製結果使用 `aria-live`。密碼眼睛按鈕為真正的 button 且含動態 accessible name。

停用 checkbox 預設勾選。使用者取消時立即顯示「本版建立後無法重新啟用」說明，成功結果保留複製功能但不顯示開啟按鈕。

### 建立 API 的自訂短碼與啟用契約

`POST /api/links` 增加選填 `shortCode` 與 `enabled`。自訂短碼規則為 4–32 個小寫英數或連字號、頭尾必須是英數，且不得等於保留頂層路徑；第一版保留清單至少包含 `health` 與 `api`。省略 `shortCode` 時沿用既有 7 碼大小寫英數產生器及最多五次碰撞重試；指定短碼時不重試也不改名，唯一約束衝突回 `409 SHORT_CODE_TAKEN`。

`enabled` 省略時視為 true，只有 boolean 合法。成功回應新增 `enabled`；其他既有欄位與密碼不洩漏契約不變。前端只在有內容時傳 `shortCode`、`note`、`password`，但固定傳 boolean `enabled`。前後端都驗證以提供即時 UX 與不可繞過的伺服器邊界。

### 停用連結以 404 隱藏

Prisma `Link` 新增非 null 的 `isEnabled Boolean @default(true)`，migration 讓所有既有列保持啟用。轉址與 unlock 查到 disabled record 時共用既有 not-found 路徑，回 `404 NOT_FOUND`，不得顯示密碼表單、Location 或「已停用」訊息。

替代方案是回 410 或專用 disabled 錯誤，但會揭露短碼確實存在；第一版選擇與未知短碼不可區分。

### 伺服器密碼頁沿用首頁視覺語言

保留 `GET /:code` 直接回傳的伺服器 HTML 表單，使用內嵌 CSS 將主內容設為至少滿視窗高度，並以 flex 讓卡片在水平與垂直方向置中。背景、深色標題、次要說明、白色圓角卡片、淡色邊框與陰影、輸入框 focus ring，以及深色主要按鈕，均對齊 Vue 建立頁現有的 slate 色系與圓角層級；卡片保留窄螢幕左右留白與最大寬度，避免手機水平 overflow。

密碼錯誤仍在相同頁面顯示，並透過 `role="alert"` 讓輔助技術辨識；表單的 method、action、欄位 name、autocomplete 與 required 契約不變。替代方案是新增 Vue unlock route，但會改變部署路由分工、增加載入與 hydration 範圍，不符合這次只統一樣式的需求。

### 由後端受限擷取頁面 metadata

瀏覽器直接抓第三方頁面會受 CORS 限制，因此新增 `POST /api/page-metadata`。後端使用 Node `http`／`https` request helper 與 HTML parser，而不是讓前端代理任意內容。URL 只允許 http/https、預設 80/443 port、無 credentials。每一跳先以 `node:dns/promises` 取得所有 A/AAAA 位址，任一位址非公開即拒絕；實際 socket 的 lookup 固定使用已驗證位址，避免驗證後重新解析造成 DNS rebinding。redirect 由程式手動處理，最多三次且每一跳重新驗證。

整條擷取鏈共用五秒 deadline；請求送出 `Accept-Encoding: identity`，只接受 `text/html` 或 `application/xhtml+xml`，最多讀取 1 MiB。以 HTML parser 讀取 `title` 與大小寫不敏感的 `meta[name=description]`，壓縮空白後分別截至 300 與 500 字元。網址或網路目標不安全回 `400 INVALID_URL`；逾時、DNS／連線失敗、redirect 超限、非 HTML 或內容過大回 `422 METADATA_UNAVAILABLE`，不得把底層錯誤或頁面內容傳給用戶端。

### metadata 預填不覆蓋使用者內容

前端 metadata action 擁有獨立 pending/error 狀態，不共用建立送出狀態。只有通過本地 URL 驗證才可呼叫 API。結果以非空 title、description 依序用換行組合並截至 500 字元；note 為空時直接套用，已有內容時保存原值並顯示「以頁面資訊取代」動作。空結果或錯誤只顯示非阻斷訊息，使用者仍可手填並建立。

替代方案是每次抓取都覆蓋備註，但會造成無法復原的輸入遺失，因此不採用。

### 同源 API 與短碼路由分工

Axios client 使用相對 `/api` base URL；Vite dev server 將 `/api` proxy 到 `http://localhost:3000`，避免為本機開發修改後端 CORS。後端回傳的 `shortUrl` 仍由 `BASE_URL` 決定，因此本機結果可直接開到 Express，生產環境則由同一公開 origin 處理。

生產 Nginx 必須在 SPA fallback 前代理 `/api/`、`/health`、符合自動或自訂短碼格式的單層路徑，以及 `/:code/unlock` 到 Express。Vue 本次只擁有 `/`，不得攔截短碼或 unlock。實際 Nginx 檔案不在本變更範圍，但 README 必須記錄這個部署路由契約。

### 前後端分層測試

後端沿用 `node:test` 與 supertest。links／redirect 整合測試連真實 PostgreSQL；metadata router 透過注入 resolver 與 request helper 測試公開／私有位址、redirect、逾時、類型與大小，禁止測試實際連外。前端使用 Vitest、Vue Test Utils 與 mocked Axios 驗證表單 payload、錯誤對應、metadata 防覆蓋、成功結果與可存取狀態；production build 負責驗證 Vite/Tailwind 整合。

視覺驗收至少涵蓋 320、375、768 像素與桌機寬度，另以真實後端完成自動短碼、自訂短碼、密碼保護、metadata、複製及 disabled 404 的端到端手動檢查。

## Implementation Contract

**可觀察行為：**

- 使用者造訪 `/` 可在無登入下建立短網址。有效輸入成功後顯示可複製結果；enabled 結果可開啟，disabled 結果只可複製並顯示不可重新啟用提示。
- metadata 抓取可填入空白 note；不得自動覆蓋既有 note。metadata 失敗不得清空輸入或封鎖建立。
- 自訂短碼保持原字串；格式錯誤在前端先阻止，繞過前端仍由後端回 400。衝突回 409 且不覆蓋既有 Link。
- disabled Link 無論有無密碼，在 GET 與 unlock 都與未知短碼相同地回 404。
- enabled 且受密碼保護的 Link 回傳置中的密碼卡片；其視覺使用與首頁相同的淺色背景、白色圓角卡片、slate 字色、輸入 focus ring 與深色主要按鈕，錯誤密碼仍在卡片內顯示可存取的錯誤訊息。

**介面與資料形狀：**

`POST /api/links` 請求：

```json
{
  "originalUrl": "https://example.com/docs",
  "shortCode": "project-docs",
  "note": "Example Docs\nReference guide",
  "password": "correct-horse",
  "enabled": true
}
```

`shortCode`、`note`、`password` 可省略；`enabled` 可省略並預設 true。成功回應為：

```json
{
  "shortCode": "project-docs",
  "shortUrl": "https://sho.rt/project-docs",
  "originalUrl": "https://example.com/docs",
  "note": "Example Docs\nReference guide",
  "passwordProtected": true,
  "enabled": true,
  "createdAt": "2026-07-29T10:00:00.000Z"
}
```

新增錯誤：`INVALID_SHORT_CODE`（400）、`INVALID_ENABLED`（400）、`SHORT_CODE_TAKEN`（409）。既有 `INVALID_URL`、`INVALID_NOTE`、`INVALID_PASSWORD` 與 500 契約不變。

`POST /api/page-metadata` 請求與成功回應：

```json
{ "originalUrl": "https://example.com/docs" }
```

```json
{ "title": "Example Docs", "description": "Reference guide" }
```

錯誤為 `INVALID_URL`（400）或 `METADATA_UNAVAILABLE`（422），沿用 `{ "error": { "code": "...", "message": "..." } }` 外層形狀。

**失敗模式：**

- 前端驗證錯誤關聯至欄位並聚焦第一個錯誤；API 欄位錯誤映射回相同欄位，網路／未知錯誤顯示表單層級且保留輸入。
- Clipboard API 失敗時顯示可選取的短網址與複製失敗訊息，不把建立結果判為失敗。
- metadata 無欄位時回 200 空字串；遠端不可用時回 422；安全檢查不通過時在連線前回 400。
- migration 或資料庫錯誤維持既有 500 sanitization，不回傳 Prisma 細節。
- 密碼頁僅調整伺服器 HTML 與 CSS；不得改變 `POST /:code/unlock`、`password` 欄位名稱、正確密碼 302 或錯誤密碼 401 的行為。

**驗收條件：**

- `backend/test/links.test.js` 覆蓋自訂／自動短碼、格式、保留字、衝突、enabled default／false／invalid；`backend/test/redirect.test.js` 覆蓋 disabled GET 與 unlock；`backend/test/page-metadata.test.js` 覆蓋 extraction 及全部網路邊界。
- frontend 元件測試覆蓋 validation、payload omission、metadata 防覆蓋、pending、error mapping、copy 與 enabled 結果差異。
- `backend/test/redirect.test.js` 覆蓋密碼頁的置中容器、首頁一致的關鍵樣式、既有表單契約與錯誤訊息可存取性。
- 在 `backend/` 執行 `npm test` 全部通過；在 `frontend/` 執行 test、lint 與 build 指令全部通過；專案根目錄執行 `spectra validate add-link-creation-web-ui` 通過。
- 手動在 320、375、768 與桌機寬度確認沒有水平 overflow，並以真實資料庫與 Express 完成建立及轉址主線。

**範圍邊界：**

- 在範圍內：Vue 建立頁、API service、前端測試與 Vite proxy；建立 API 的 shortCode/enabled 擴充；Link enabled migration；disabled 404；伺服器密碼頁的置中與視覺統一；安全 metadata endpoint；README 開發與部署路由說明。
- 不在範圍內：會員／權限、列表與修改 API、重新啟用、將解鎖流程改成 Vue route、顯示／隱藏密碼互動、metadata 持久化、第三方 preview service、Nginx 實際設定、GCP／TLS／CI。

## Risks / Trade-offs

- [外部 HTML 可能惡意構造或極大] → 在 parser 前限制媒體類型、五秒 deadline 與 1 MiB，且只抽取文字欄位。
- [SSRF 的 DNS rebinding 與 redirect 可繞過單次 URL 檢查] → 每一跳解析全部位址、拒絕任一非公開位址，並把 socket lookup 固定到已驗證位址。
- [停用後沒有重新啟用入口] → checkbox 預設啟用，關閉前後都清楚提示限制；資料欄位仍為後續管理 API 保留能力。
- [Nginx SPA fallback 可能吃掉短碼] → README 明列代理優先順序，真實環境驗收包含短碼 GET 與 unlock。
- [前後端重複驗證可能 drift] → spec 以同一組長度、字元與保留字案例驅動兩邊測試，後端永遠是最終權威。
- [伺服器密碼頁與 Vue 首頁的樣式可能隨時間分歧] → 測試鎖定置中、色系與元件層級等關鍵視覺 token，不複製與本頁無關的完整前端樣式。

## Migration Plan

1. 先套用新增 `isEnabled` 且預設 true 的 Prisma migration，確認既有 Link 全部為 enabled。
2. 部署支援新欄位與 metadata 的後端，保留舊請求省略新欄位時的相容行為。
3. 部署 frontend 靜態檔並套用既定 Nginx 代理優先順序。
4. 驗證健康檢查、建立 API、首頁、短碼轉址、protected unlock、disabled 404 與 metadata。
5. 若需回退，先回退前端與後端；`isEnabled` 欄位保留在資料庫，不執行破壞性降版 migration。

## Open Questions

無。產品範圍、JavaScript 技術選擇、自訂短碼規則、metadata 預填與 disabled 行為均已確認。
