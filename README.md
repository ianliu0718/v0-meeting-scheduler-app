# Web Push 通知 (免費方案)

本專案已改採 Web Push 作為主要通知渠道，Email 僅保留停用路由作備援佔位 (`/api/notify` 回傳 EMAIL_DISABLED)。

## 環境變數設定
在 `.env.local` 內新增：

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=你的VAPID公鑰
VAPID_PRIVATE_KEY=你的VAPID私鑰
PUSH_APP_NAME=ScheduleTime
SUPABASE_SERVICE_ROLE_KEY=（可選，用於伺服端 upsert push_subscriptions）
```

產生金鑰：

```powershell
npx web-push generate-vapid-keys
```

輸出範例：
```
Public Key:  BExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Private Key: sMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
將 Public 放入 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`，Private 放入 `VAPID_PRIVATE_KEY`。

## 資料表與 RLS
SQL 在 `docs/sql-push-subscriptions.sql`，建立 `push_subscriptions`：
```sql
create table if not exists public.push_subscriptions (
	id uuid primary key default gen_random_uuid(),
	tenant_id text not null,
	event_id text not null,
	participant_id uuid,
	endpoint text not null unique,
	p256dh text not null,
	auth text not null,
	created_at timestamptz default now()
);
```

## 前端使用
事件頁 (`app/event/[id]/page.tsx`) 會顯示「啟用通知」按鈕：
1. 使用者同意瀏覽器通知權限。
2. 註冊 Service Worker `public/sw.js`。
3. 取得 subscription 並呼叫 `/api/push/subscribe` 儲存。
4. 新參與者加入後呼叫 `/api/push/notify` 對所有訂閱者推播。

## Realtime + Toast
利用 Supabase Realtime 監聽 `participants` 的 INSERT 事件，在前端觸發 toast 顯示誰剛更新。

## 測試步驟
1. 填好 `.env.local` 中的 VAPID 變數並重啟 `npm run dev`。
2. 進入某事件頁，點「啟用通知」。看 Console 應有 subscription 成功訊息。
3. 在另一瀏覽器視窗或無痕模式新增一個參與者。
4. 原視窗應看到：
	 - Realtime 刷新參與者列表
	 - Toast 顯示新參與者名稱
	 - 系統通知 (若瀏覽器支援背景顯示)

## 常見問題
| 問題 | 原因 | 解法 |
|------|------|------|
| 提示缺少 VAPID 公鑰 | 未設定環境變數 | 設定 `NEXT_PUBLIC_VAPID_PUBLIC_KEY` 後重新 build |
| 推播訂閱 410 EMAIL_DISABLED | 誤呼叫舊 email 路由 | 前端已移除，清快取、重新整理 |
| iOS 背景沒通知 | iOS 需加入主畫面 | 引導使用者使用 Safari 加到主畫面後再同意通知 |

## 後續擴充建議
1. 加入通知偏好（允許使用者關閉某事件的推播）。
2. 推播 payload 加入參與者詳細欄位（例如可用時段摘要）。
3. 將 `/api/push/notify` 觸發搬到後端邏輯（資料庫 trigger + edge function）。

# Meeting scheduler app

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/ianlius-projects-2cfb0ea7/v0-meeting-scheduler-app)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/gC7ihSeVbZ2)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/ianlius-projects-2cfb0ea7/v0-meeting-scheduler-app](https://vercel.com/ianlius-projects-2cfb0ea7/v0-meeting-scheduler-app)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/gC7ihSeVbZ2](https://v0.app/chat/gC7ihSeVbZ2)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Languages

This app (ScheduleTime) currently supports 4 languages:

- English (`en`)
- 繁體中文 (`zh-TW`)
- Español (`es`)
- Tagalog (`tl`)

To change the default language at first load, the app auto-detects the browser language and falls back to English.