## Context

Linkfold 的後端目前只有一個空的 `backend/index.js` 與已安裝的 Express 5，沒有資料庫、沒有路由、沒有測試框架（`npm test` 目前是回傳錯誤的佔位指令）。本變更要建立第一條可運作的端到端主線：建立短網址與短碼轉址，讓建立者選填一般備註與共享密碼，並同時引入 PostgreSQL、Prisma 與測試框架。

約束條件：

- 後端使用 ESM（`backend/package.json` 已設 `"type": "module"`），所有新檔案使用 `import` / `export`。
- 資料庫為 PostgreSQL，Schema 與 Migration 一律透過 Prisma 管理，不手寫 SQL DDL。
- 本機開發以 Docker Compose 啟動 PostgreSQL，不要求開發者在主機安裝 PostgreSQL。
- 專案採 TDD（`.spectra.yaml` 設定 `tdd: true`），每個具行為的功能先寫測試再寫實作。
- 文件、註解與 commit message 使用繁體中文（台灣）。

## Goals / Non-Goals

**Goals:**

- 打通「建立短網址 → 造訪短網址 → 必要時驗證共享密碼 → 轉址到原始網址」的端到端流程。
- 讓建立者在建立當下選填最多 500 字元的備註，以及 8–128 字元的共享密碼。
- 建立可長期沿用的 `Link` 資料模型與 Prisma migration 基礎。
- 建立後端分層結構，讓 Express app 可被測試直接載入，不需啟動實際 server。
- 讓 `npm test` 成為真正可執行、可信賴的驗證指令。

**Non-Goals:**

- 不建立 `frontend/`，不寫任何 Vue 程式碼。
- 不記錄點擊次數，`Link` 資料表本次不含 clicks 欄位。
- 不支援自訂短碼與有效期限。
- 不做使用者帳號、登入、建立者權限、管理權杖或備註隱私保證。
- 不做建立後的備註編輯、密碼修改／移除、刪除、密碼重設或解鎖 session。
- 不撰寫後端 Dockerfile、Nginx 設定，不處理網域與 HTTPS。
- 不做速率限制、惡意網址過濾、短碼猜測防護。

## Decisions

### 將 Express app 與 server 啟動分離

`backend/src/app.js` 匯出建立好的 Express app（`export default app`），`backend/index.js` 只負責讀取 `PORT` 並呼叫 `app.listen()`。

理由：測試要用 supertest 直接對 app 發請求，若 app 與 `listen()` 寫在同一個檔案，載入模組就會佔用連接埠，測試會互相干擾且無法平行執行。

替代方案：測試時啟動真實 server 再用 fetch 打。缺點是要自行管理連接埠分配與關閉時機，測試更慢也更不穩定，故不採用。

### 以 node:crypto 自行實作短碼產生器，不引入 nanoid

`backend/src/lib/short-code.js` 匯出 `generateShortCode(length = 7)`，使用 `crypto.randomInt` 從 62 字元字母表（`0-9`、`A-Z`、`a-z`）取值。

理由：需求極小（一個函式、十餘行），自行實作可省下一個執行期相依套件，也讓這段邏輯有明確的單元測試目標。`crypto.randomInt` 為均勻分布，不會有 `Math.random() % n` 的取模偏差問題。

替代方案：引入 nanoid。功能等價但多一個相依套件，且預設字母表含 `-` 與 `_`，短網址在部分情境下較不易口述，故不採用。

長度取 7：62^7 約 3.5 兆組合，對本階段（單機、無流量壓力）足夠稀疏，且短碼夠短。

### 短碼唯一性靠資料庫唯一約束加重試

`Link.shortCode` 在 Prisma schema 標記 `@unique`。建立流程為：產生短碼 → 嘗試寫入 → 若 Prisma 回傳唯一約束衝突（錯誤碼 `P2002`）則重新產生並重試，最多重試 5 次，全數失敗回 500。

理由：先查詢再寫入（check-then-insert）在並行請求下有競態條件，兩個請求可能同時查到「不存在」而寫入相同短碼。以資料庫唯一約束為單一真實來源，是唯一在並行下正確的做法。

### 資料模型：Link 資料表

核心欄位為 `id`（自增主鍵）、`shortCode`（唯一字串）、`originalUrl`（字串）、`createdAt`（預設 `now()`）；第二支 migration 再加入可為 null 的 `note` 與 `passwordHash`。`shortCode` 建立唯一索引。`note` 沒有建立者權限保護，不得存放敏感資訊；`passwordHash` 為 null 表示不需要密碼。

理由：保留第一支已完成的核心 migration，再以第二支 migration 表達討論後新增的需求，避免重寫已完成的 migration 歷史。仍只加入本變更會實際使用的欄位；clicks 等統計欄位屬於後續變更。

### 密碼使用 bcrypt cost 12 雜湊後保存

`POST /api/links` 收到選填的 `password` 後，先驗證它是 8–128 字元的字串，再由 `backend/src/lib/password.js` 將 UTF-8 密碼做 SHA-256 並以 Base64 表示，接著使用 bcrypt cost factor 12 產生雜湊，只把最終結果寫入 `Link.passwordHash`。解鎖時使用完全相同的前處理再做 bcrypt 比對。未提供 `password` 時保存 null。API 回應、HTML、server log 與錯誤訊息都不得包含原始密碼、中間摘要或 `passwordHash`。

理由：共享密碼不能以明文或可逆形式保存；bcrypt 具備 salt 與可調整成本，cost 12 在第一版提供明確且可測試的安全基準。bcrypt 原生只使用輸入前 72 bytes，先做固定長度 SHA-256 可讓已確認的 128 字元上限完整參與驗證。將前處理、雜湊與比對集中在單一 helper，可避免建立與解鎖路由各自處理密碼細節。

替代方案：使用明文欄位實作成本較低，但資料庫外洩時會直接暴露密碼，故不採用。會員登入與管理權杖能提供建立者身份，但超出第一版需求，亦不採用。

### 受保護連結使用伺服器產生的密碼頁

`GET /:code` 查到 `passwordHash` 為 null 時直接 302；有值時回 200 `text/html` 密碼表單，表單以 `application/x-www-form-urlencoded` 提交到 `POST /:code/unlock`。解鎖路由重新查詢 Link，使用 bcrypt 比對密碼；正確時回 302，錯誤或缺少密碼時回 401 並重新顯示不含備註的表單。不存在的短碼在 GET 與 POST 都回 404 JSON。

理由：使用者已選擇瀏覽器可直接操作的密碼頁，而本變更仍不建立 Vue 前端。由 Express 回傳最小 HTML 可完成端到端體驗，也不需要登入或 session。

替代方案：將密碼放在 query string 會進入瀏覽器歷史與 server log，故不採用。建立解鎖 cookie 可免除重複輸入，但會引入 session、cookie 簽章與生命週期設計，第一版不採用。

### 網址驗證使用 WHATWG URL 並限定 http/https

`POST /api/links` 以 `new URL(originalUrl)` 解析，解析失敗或協定不是 `http:` / `https:` 一律回 400。

理由：Node.js 內建、行為符合瀏覽器標準，不需引入驗證套件。限定協定可擋掉 `javascript:`、`data:` 等會在轉址時造成風險的協定。

替代方案：正規表示式驗證。易寫錯且維護成本高，不採用。

### 轉址路由註冊在最後，避免遮蔽既有路徑

`GET /:code` 是萬用路由，會匹配任何單層路徑。因此在 `app.js` 中先註冊 `GET /health` 與 `/api` 相關路由，最後才註冊轉址路由。

理由：Express 依註冊順序匹配，順序寫反會讓 `/health` 被轉址路由吃掉。此外短碼固定 7 碼英數，與 `health`、`api` 等既有路徑天然不重疊，兩層防護並存。

### 測試策略：node:test 搭配 supertest

使用 Node.js 內建測試執行器（`node --test`），HTTP 層以 `supertest` 對匯出的 app 發請求。`backend/package.json` 的 `test` script 改為 `node --test`。

理由：內建測試器不需額外測試框架相依，原生支援 ESM，與 Node 版本同步演進。supertest 讓 HTTP 測試不必啟動實際 server。

替代方案：Vitest 或 Jest。功能更豐富但對本專案規模是多餘的相依與設定成本，故不採用。

### 本機 PostgreSQL 以 Docker Compose 提供

專案根目錄新增 `docker-compose.yml`，定義一個 PostgreSQL 15 服務，對外映射 5432，資料以具名 volume 持久化。連線字串由 `backend/.env` 的 `DATABASE_URL` 提供，並附上 `backend/.env.example` 範本；`.env` 加入 `.gitignore`。

理由：開發者只需有 Docker，不必在主機安裝與設定 PostgreSQL；容器版本固定也讓所有人的環境一致。

## Implementation Contract

**行為：**

- 呼叫端 `POST /api/links` 帶入合法的 http/https 網址，得到 201 與一組短碼；接著以瀏覽器造訪該短網址，會被轉址到原始網址。
- 呼叫端造訪不存在的短碼，得到 404 而非轉址或崩潰。
- 開發者執行 `npm test`（於 `backend/`）會實際執行測試並回報結果，而非印出錯誤訊息後退出。

**介面與資料形狀：**

`POST /api/links`

- 請求：`Content-Type: application/json`，必要欄位為 `originalUrl`；選填 `note` 必須是最多 500 字元的字串，選填 `password` 必須是 8–128 字元的字串。只有欄位完全省略才表示不設定；型別錯誤或超出長度一律回 400。
- 成功回應：`201 Created`

  ```json
  {
    "shortCode": "aB3xY9z",
    "shortUrl": "http://localhost:3000/aB3xY9z",
    "originalUrl": "https://example.com/some/path",
    "note": "Prisma 文件",
    "passwordProtected": true,
    "createdAt": "2026-07-27T10:00:00.000Z"
  }
  ```

- `shortUrl` 由環境變數 `BASE_URL` 與 `shortCode` 組成。回應不得包含 `password` 或 `passwordHash`。

`GET /:code`

- 未受保護：`302 Found`，`Location` 標頭為 `originalUrl`，回應主體為空。
- 受保護：`200 OK`、`Content-Type: text/html`，回傳提交至 `POST /:code/unlock` 的密碼表單；HTML 不包含 `note`、`originalUrl` 或 `passwordHash`。
- 失敗：`404 Not Found`，主體為錯誤 JSON。

`POST /:code/unlock`

- 請求：`Content-Type: application/x-www-form-urlencoded`，欄位 `password`。
- 密碼正確：`302 Found`，`Location` 標頭為 `originalUrl`，回應主體為空。
- 密碼錯誤或缺少：`401 Unauthorized`，重新回傳不含備註與目標網址的密碼表單。
- 短碼不存在：`404 Not Found`，主體為錯誤 JSON。

`GET /health`

- 成功：`200 OK`，主體 `{ "status": "ok" }`。

錯誤回應統一形狀：

```json
{ "error": { "code": "INVALID_URL", "message": "originalUrl 必須是 http 或 https 網址" } }
```

錯誤碼：`INVALID_URL`（400）、`INVALID_NOTE`（400）、`INVALID_PASSWORD`（400）、`NOT_FOUND`（404）、`INTERNAL_ERROR`（500）。解鎖密碼錯誤使用 401 HTML，不回傳 JSON 錯誤碼。

`generateShortCode(length = 7)`：回傳長度為 `length` 的字串，字元僅來自 `0-9A-Za-z`。

**失敗模式：**

- `originalUrl` 缺漏、非字串、無法被 `new URL()` 解析、或協定不是 http/https → 400 `INVALID_URL`。
- `note` 有提供但不是字串或超過 500 字元 → 400 `INVALID_NOTE`，不寫入資料庫。
- `password` 有提供但不是字串、少於 8 字元或超過 128 字元 → 400 `INVALID_PASSWORD`，不寫入資料庫。
- 解鎖密碼缺少或比對失敗 → 401，重新顯示密碼表單且不洩漏備註、原始網址或雜湊。
- 短碼查無資料 → 404 `NOT_FOUND`。
- 短碼碰撞連續 5 次 → 500 `INTERNAL_ERROR`。
- 資料庫連線失敗 → 500 `INTERNAL_ERROR`，且錯誤詳情寫入 server log，不回傳給呼叫端。
- 所有 500 一律經由 Express 錯誤處理中介層產生，不允許以 try/catch 吞掉錯誤後回傳成功。

**驗收條件：**

- `backend/test/short-code.test.js` 通過：驗證回傳長度正確、字元僅在字母表內、連續產生 1000 次無重複。
- `backend/test/password.test.js` 通過：SHA-256 前處理加 bcrypt cost 12 產生的雜湊不等於原始密碼，正確密碼比對成功，錯誤密碼比對失敗，且前 72 bytes 相同但尾端不同的長密碼不會互相通過。
- `backend/test/links.test.js` 通過：合法網址可在有／無選填欄位時建立；備註與 `passwordProtected` 正確回傳但密碼及雜湊不回傳；無效網址、備註或密碼各回對應的 400 且不新增資料。
- `backend/test/redirect.test.js` 通過：未受保護連結直接 302；受保護連結 GET 回密碼頁、正確 POST 回 302、錯誤 POST 回 401 且頁面不洩漏備註或目標網址；未知短碼回 404；`/health` 不被遮蔽。
- 於 `backend/` 執行 `npm test` 全部通過。
- 手動驗證：`docker compose up -d` 後執行 `npx prisma migrate dev`，資料庫中的 `Link` 具有 nullable `note`、nullable `passwordHash` 與 `shortCode` 唯一索引；以 curl 建立未受保護連結可直接 302，建立受保護連結則先取得密碼頁，提交正確密碼後 302。

**範圍邊界：**

- 在範圍內：`/health`、`POST /api/links`、`GET /:code`、`POST /:code/unlock`；`Link` 資料表的核心 migration 與新增 `note`／`passwordHash` 的第二支 migration；短碼與密碼 helper；Express 產生的最小密碼頁；Docker Compose PostgreSQL；測試框架與對應測試。
- 不在範圍內：Vue 前端、點擊統計、自訂短碼、有效期限、列出／編輯／刪除短網址、使用者帳號、建立者權限、管理權杖、密碼重設、解鎖 session、速率限制、惡意網址過濾、後端 Dockerfile、Nginx 與 CI。

## Risks / Trade-offs

- 整合測試需要真實資料庫，開發者若未啟動 Docker 容器，測試會失敗且錯誤訊息可能難以理解 → 在 `backend/README` 說明與測試失敗訊息中明確指出需先執行 `docker compose up -d`；測試不使用 mock，以確保 Prisma 查詢與唯一約束真的被驗證到。
- 測試會寫入與開發共用的資料庫，殘留資料可能干擾後續測試 → 每支整合測試在 `after` 鉤子刪除自己建立的資料列，並以隨機網址避免測試間互相影響。
- 短碼 7 碼且可被列舉，理論上可被掃描出連結並嘗試共享密碼 → 密碼至少 8 字元且以 bcrypt cost 12 驗證，但本階段沒有速率限制，明確不把它定位為抵抗高流量暴力猜測的完整存取控制。
- 備註沒有會員或管理權杖保護，無法保證只讓建立者讀取 → 不在轉址與密碼頁顯示備註，並明確要求備註不得存放敏感資訊。
- 不建立解鎖 session，訪客每次造訪受保護連結都要重新輸入密碼 → 接受重複輸入以換取無 cookie、無 session 的簡單第一版。
- `GET /:code` 為萬用路由，未來新增頂層路徑時容易被遮蔽 → 以「新路徑一律加在轉址路由之前」為慣例，並由 `/health` 的測試守住這條規則。

## Migration Plan

1. 保留已完成的 `init_link` migration，不回寫或重排既有 SQL。
2. 修改 Prisma model，產生名為 `add_link_note_password_hash` 的第二支 migration，加入 nullable `note` 與 nullable `passwordHash`，讓既有資料列可無資料回填地升級。
3. 先套用 migration，再部署會讀寫新欄位的應用程式。
4. 若應用程式需要回退，先回退至不讀寫新欄位的版本；nullable 欄位可保留，不執行破壞性降版 migration。
