# 不連續日期功能說明

## 功能概述

現在建立活動時可以選擇不連續的日期，例如：
- 只選週一、週三、週五
- 跳過特定假日
- 選擇月初和月底的幾天

## 使用方式

### 建立活動時

1. 進入「建立活動」頁面
2. 在「日期範圍」區塊使用多日期選擇器
3. **點擊**個別日期來選取或取消
4. **拖曳**連續多天快速選取
5. 已選日期會顯示藍色背景
6. 提交後會儲存這些不連續的日期

### 參與活動時

- 活動頁面會自動顯示活動建立時選取的日期
- 只會看到被選取的那些日期（不是整段連續日期）
- 可用時間標記、熱力圖等功能正常運作

## 技術實作

### 資料庫 Schema

```sql
-- events 表新增欄位
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS selected_dates JSONB;
```

### 資料流程

1. **建立活動** (`app/create/page.tsx`)
   - 使用者透過 `MultiDatePicker` 選擇日期
   - 將 `selectedDates` 陣列傳給 `createEvent()`
   - 儲存至 DB 的 `selected_dates` 欄位（JSONB 格式）

2. **讀取活動** (`lib/db.ts`)
   - `getEvent()` 從 DB 讀取 `selected_dates`
   - 解析 JSONB 為 `Date[]` 陣列
   - 放入 `Event.selected_dates` 屬性

3. **顯示日曆** (`components/availability-calendar.tsx`)
   - 優先使用 `selectedDates` props
   - 若為空則回退到 `startDate` 到 `endDate` 的連續日期
   - 確保向後相容舊活動

### 型別定義

```typescript
export interface Event {
  id: string
  title: string
  description?: string
  start_date: Date
  end_date: Date
  selected_dates?: Date[]  // 新增：不連續日期
  start_hour: number
  end_hour: number
  timezone: string
  duration: number
  created_at: Date
}
```

## 向後相容

- 舊活動（沒有 `selected_dates` 欄位）會自動使用 `start_date` 到 `end_date` 的連續日期
- 不影響現有活動的運作
- 新活動可選擇使用連續或不連續日期

## 資料庫遷移

請在 Supabase SQL Editor 執行：

```bash
# 檔案位置
docs/migration-selected-dates.sql
```

執行後即可開始使用不連續日期功能。

## 測試建議

1. **建立不連續日期活動**
   - 選擇 3-5 個不連續的日期（例如週一、週三、週五）
   - 確認活動頁面只顯示選取的日期

2. **建立連續日期活動**
   - 選擇 7 天連續日期
   - 確認正常顯示

3. **檢查舊活動**
   - 開啟在此功能前建立的活動
   - 確認仍正常顯示連續日期

4. **標記可用時間**
   - 在不連續日期的活動中標記時段
   - 確認熱力圖、最佳時段等功能正常

## 技術細節

- 日期儲存格式：ISO 8601 字串陣列
- 排序：按時間順序排序
- 去重：自動移除重複日期
- 時區：使用活動設定的時區
- 效能：JSONB + GIN 索引確保查詢效率
