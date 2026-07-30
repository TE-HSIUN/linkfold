## 1. 建立 API 與停用狀態

- [x] 1.1 先擴充 `backend/test/links.test.js`，以失敗測試鎖定 **Create a short link from an original URL**、**Validate custom short codes**、**Reject a conflicting custom short code**、**Validate the enabled state** 的成功回應、4–32 字元邊界、保留字、409 衝突與 boolean 驗證；執行 `npm test -- test/links.test.js` 確認新案例在實作前因缺少契約而失敗。
- [x] 1.2 完成「建立 API 的自訂短碼與啟用契約」：在 Prisma schema 與新 migration 加入預設 true 的 `isEnabled`，讓 `POST /api/links` 驗證及保存 `shortCode`／`enabled`、區分自訂衝突與自動碰撞並回傳 `enabled`；套用 migration 後執行 `npm test -- test/links.test.js`，確認 1.1 全部轉綠且既有自動短碼與密碼案例不回歸。
- [x] 1.3 先在 `backend/test/redirect.test.js` 新增並實作 **Disabled short codes return not found** 與「停用連結以 404 隱藏」，確保 disabled 的一般 GET、protected GET 及 unlock 都回 `404 NOT_FOUND` 且無 Location／密碼頁；執行 `npm test -- test/redirect.test.js` 驗證 enabled 連結仍維持既有 302／密碼流程。

## 2. 安全頁面 metadata

- [x] 2.1 建立 `backend/test/page-metadata.test.js` 的注入式失敗測試，完整覆蓋 **Retrieve public page metadata**、**Restrict metadata retrieval to safe public targets**、**Bound remote metadata work** 的解析、空欄位、IP 類別、redirect、五秒逾時、1 MiB 與 content type；執行該測試檔確認案例不會真實連外且在實作前失敗。
- [x] 2.2 完成「由後端受限擷取頁面 metadata」的 URL 與 DNS 安全層：只接受無 credentials 的預設埠 HTTP/HTTPS、解析所有 A/AAAA、拒絕任一非公開位址，並提供可注入 resolver；以 2.1 的 private／reserved IPv4、IPv6 與 redirect 目標案例驗證連線前即回 `400 INVALID_URL`。
- [x] 2.3 完成固定至已驗證 IP 的 `http`／`https` 擷取 helper，讓整條 redirect chain 共用五秒 deadline、最多三次 redirect、`Accept-Encoding: identity`、1 MiB 與 HTML media type 限制；執行 2.1 的 rebinding、逾時、redirect、大小及類型案例，確認失敗統一為 `422 METADATA_UNAVAILABLE` 且不洩漏底層內容。
- [x] 2.4 建立 `POST /api/page-metadata` router 並掛在萬用短碼路由之前，使用 HTML parser 正規化及截斷 title／description；執行 `npm test -- test/page-metadata.test.js test/redirect.test.js`，確認回應只有兩個字串欄位、空 metadata 回 200，且 `/api/page-metadata` 不被 `/:code` 吃掉。

## 3. Vue 建立頁

- [x] 3.1 建立 `frontend/` 的「JavaScript Vue 單頁與局部狀態」骨架，設定 Vue Router `/`、Axios 相對 `/api`、Tailwind Vite plugin、Vitest／Vue Test Utils及「同源 API 與短碼路由分工」的 Vite proxy；執行 frontend 的 test、lint 與 build 指令，確認空白應用可建置且 dev proxy 不需要後端 CORS。
- [x] 3.2 先以 Vue Test Utils 撰寫 **Display a responsive short-link creation form** 與 **Validate creation input before submission** 的失敗測試，鎖定所有 labels、預設 enabled、密碼顯示按鈕、500 字計數、URL／短碼／密碼邊界、第一個錯誤 focus 與空選填欄位 omission；執行 focused test 確認新案例在元件完成前失敗。
- [x] 3.3 完成「響應式表單與可存取回饋」及 3.2 行為：桌機分欄、`md` 以下單欄、ARIA 關聯、pending 防重送與繁中驗證訊息；執行 3.2 focused test，並在 320、375、768 與桌機 viewport 手動確認無水平 overflow 且鍵盤可操作。
- [x] 3.4 先撰寫 **Prefill the note from page metadata** 與 **Surface API failures at the correct scope** 的失敗測試，鎖定「metadata 預填不覆蓋使用者內容」、500 字組合、空結果／錯誤非阻斷、已填 note 的明確取代動作，以及後端錯誤碼對應欄位；執行 focused test 確認所有分支都有斷言。
- [x] 3.5 完成 metadata 與錯誤互動：獨立呼叫狀態、空 note 自動套用、非空 note 等待確認、API 欄位錯誤 focus、未知／網路錯誤保留輸入；執行 3.4 focused test，確認 metadata 失敗後仍可送出建立請求。
- [x] 3.6 先撰寫 **Present creation progress and result** 的失敗測試，鎖定 pending 期間單一請求、enabled 結果的 copy／open、disabled 結果不顯示 open、Clipboard 失敗 fallback、ARIA live feedback 與建立另一個重設；執行 focused test 確認結果元件所有狀態均被覆蓋。
- [x] 3.7 完成成功結果與複製流程，讓 enabled 與 disabled 的動作、保護狀態、不可重新啟用提示及 Clipboard fallback 符合 3.6；執行 frontend 全部 test、lint 與 build，確認「前後端分層測試」的前端層全數通過。

## 4. 整合、文件與驗證

- [x] 4.1 更新 `backend/README.md` 與前端開發說明，記錄 migration、雙服務啟動、API 錯誤、metadata 限制及 SPA fallback 前的代理順序；依文件從乾淨安裝啟動後，執行後端完整 `npm test`、前端完整 test／lint／build 與 `spectra validate add-link-creation-web-ui`，再以真實 PostgreSQL／Express 驗證自動短碼、自訂短碼、密碼、metadata、複製、enabled 轉址與 disabled 404，確認文件無缺步且 repo diff 只含本 change 預期檔案。

## 5. 密碼頁版面與視覺統一

- [x] 5.1 先擴充 `backend/test/redirect.test.js`，以失敗測試鎖定 **Present a centered branded password form** 與「伺服器密碼頁沿用首頁視覺語言」：驗證 enabled protected GET 的滿視窗置中容器、淺色背景、白色圓角卡片、slate 色系、focus 樣式、深色按鈕與既有 form action／password 欄位契約，並驗證錯誤密碼的 401 頁以 `role="alert"` 顯示繁中訊息；執行 `npm test -- test/redirect.test.js` 確認新案例在樣式實作前失敗。
- [x] 5.2 完成 `backend/src/routes/redirect.js` 的置中密碼卡片與首頁一致視覺，不改變 `POST /:code/unlock`、正確密碼 302、錯誤密碼 401 或 disabled 404 行為；執行 `npm test -- test/redirect.test.js` 與 `npm test`，並在 320×568 與桌機 viewport 手動確認卡片置中、無水平 overflow 且鍵盤 focus 清楚。
