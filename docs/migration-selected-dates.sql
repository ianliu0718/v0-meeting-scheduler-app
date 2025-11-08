-- Migration: 為 events 表增加不連續日期支援
-- 日期: 2025-11-08
-- 描述: 允許活動使用不連續的日期而非只有連續的 start_date 到 end_date

-- 在 Supabase SQL Editor 中執行以下命令：

-- 1. 新增 selected_dates 欄位（JSONB 類型，儲存日期字串陣列）
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS selected_dates JSONB;

-- 2. 為 selected_dates 欄位加上索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_events_selected_dates 
ON public.events USING GIN (selected_dates);

-- 3. 更新現有資料：若 selected_dates 為 NULL，則不處理（保持向後相容）
-- 新活動若使用不連續日期會自動填入 selected_dates

-- 說明：
-- - selected_dates 為可選欄位，若為 NULL 則使用 start_date 到 end_date 的連續日期
-- - selected_dates 格式為 JSON 陣列，例如: ["2025-11-10T00:00:00Z", "2025-11-12T00:00:00Z", "2025-11-15T00:00:00Z"]
-- - 前端會優先使用 selected_dates，若無則回退到連續日期模式
