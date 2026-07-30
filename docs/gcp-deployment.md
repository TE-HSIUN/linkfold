# Linkfold GCP 部署手冊

本手冊記錄 Linkfold 在單台 GCP Compute Engine VM 上的首次部署、更新、
檢查與復原方式。Production 使用 Docker Compose 執行 Nginx、Express 與
PostgreSQL 15，目前僅提供 HTTP。

## 環境需求

VM 需先安裝 Git、Docker Engine 與 Docker Compose v2，並允許 HTTP 流量。
第一次部署時下載 repository：

```bash
git clone https://github.com/TE-HSIUN/linkfold.git
cd linkfold
```

## 1. 建立正式環境設定

複製可提交的範本；實際 `.env.production` 已被 Git 忽略：

```bash
cp .env.production.example .env.production
```

產生 32 bytes、只含十六進位字元的隨機資料庫密碼：

```bash
openssl rand -hex 32
```

使用文字編輯器開啟 `.env.production`，將輸出貼到
`POSTGRES_PASSWORD=` 後方，並設定公開網址：

```dotenv
BASE_URL=http://34.122.24.161
```

不要提交 `.env.production`，也不要將密碼貼到 issue、PR 或聊天訊息。

## 2. 檢查並啟動服務

確認必要變數與 Compose 設定有效；這一步不會啟動容器，也不會輸出秘密：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
```

建置 images，並在背景啟動 PostgreSQL、Express 與 Nginx：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Backend 啟動時會先執行 `prisma generate` 與 `prisma migrate deploy`，
成功後才啟動 Express。

## 3. 驗證部署

查看三個服務的狀態：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

在 VM 內檢查經過 Nginx 代理的健康端點與首頁：

```bash
curl -i http://127.0.0.1/health
curl -I http://127.0.0.1/
```

健康端點應回 HTTP 200 與 `{"status":"ok"}`。接著可從瀏覽器開啟
`http://34.122.24.161/`。

## 查看 logs

若服務未正常啟動，查看最近 100 行 logs：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100
```

持續追蹤 logs 時加上 `--follow`。按 `Ctrl+C` 只會停止追蹤，不會停止容器：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --follow --tail=100
```

## 更新部署

取得 `main` 的最新程式碼，重新建置並套用更新：

```bash
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

PostgreSQL named volume 會保留。更新後再次執行 `ps`、健康檢查與首頁檢查。

## 停止與復原

停止並移除容器與網路，但保留 PostgreSQL named volume：

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down
```

再次執行 `up -d --build` 即可使用原有資料重新啟動。

> 請勿執行 `docker compose down -v` 或在上述指令加入 `down -v`。
> `-v` 會刪除 PostgreSQL named volume，可能造成所有短網址資料永久遺失；
> 只有在明確要清空資料且已確認備份時才能使用。
