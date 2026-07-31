## 1. TDD 重現正式站複製失敗

- [x] 1.1 依 `Present creation progress and result` requirement 擴充 `frontend/src/__tests__/CreateLinkView.test.js`：驗證 Clipboard API 成功時不呼叫 fallback、API 不存在時 fallback 成功、API 拒絕後 fallback 成功，以及 fallback 回傳 false 或拋錯時保留完整選取並顯示手動提示；先執行 `cd frontend && npm test -- --run src/__tests__/CreateLinkView.test.js`，確認新增的 fallback 成功案例因尚未實作而紅燈。

## 2. 最小複製修正

- [x] 2.1 在 `frontend/src/components/LinkResultCard.vue` 保留單一按鈕與 Clipboard API 主要路徑，並在 API 不存在或拒絕時選取現有短網址 input、呼叫 `document.execCommand('copy')`；fallback 回傳 true 時顯示「短網址已複製」，回傳 false 或拋錯時保留選取並顯示手動複製提示。執行 `cd frontend && npm test -- --run src/__tests__/CreateLinkView.test.js`，確認第 1.1 項所有主要、fallback 與失敗案例轉綠。

## 3. 回歸與正式環境驗收

- [x] 3.1 確認修正未改變結果卡其他行為、公開 API 或 production build；依序執行 `cd frontend && npm test`、`npm run lint`、`npm run build`，三項皆須以 exit code 0 完成。
- [ ] 3.2 使用既有 GCE 更新流程部署新的 frontend image 後，在目前公開 HTTP 網址建立一筆測試短網址，按一次「複製短網址」並貼入純文字欄位；貼上的內容必須與結果卡顯示的完整短網址逐字一致，且 live region 顯示「短網址已複製」。不變更 Compose、Nginx、`BASE_URL`、後端或資料庫設定。
