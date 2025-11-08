"use client"

import React, { useState, useRef, useEffect } from "react"
import type { TimeSlot } from "@/lib/types"
import { useLanguage } from "@/lib/i18n/language-context"
import { cn } from "@/lib/utils"

interface AvailabilityCalendarProps {
  startDate: Date
  endDate: Date
  selectedDates?: Date[]  // 不連續日期（優先使用）
  startHour: number
  endHour: number
  selectedSlots: TimeSlot[]
  onSlotsChange?: (slots: TimeSlot[]) => void
  heatmapData?: Map<string, number>
  maxParticipants?: number
  readOnly?: boolean
  onSlotFocus?: (date: Date, hour: number) => void
  // 新增互動選項
  longPressToDrag?: boolean // 手機長按 200~300ms 才進入拖曳模式
  previewBeforeCommit?: boolean // 拖曳中僅顯示預覽，放手才提交
  longPressDelayMs?: number // 自訂長按延遲，預設 250ms
}

export function AvailabilityCalendar({
  startDate,
  endDate,
  selectedDates,
  startHour,
  endHour,
  selectedSlots,
  onSlotsChange,
  heatmapData,
  maxParticipants = 1,
  readOnly = false,
  onSlotFocus,
  longPressToDrag = true,
  previewBeforeCommit = false,
  longPressDelayMs = 250,
}: AvailabilityCalendarProps) {
  const { t } = useLanguage()
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false) // 用 ref 立即追蹤拖曳狀態
  const [dragStart, setDragStart] = useState<{ date: Date; hour: number } | null>(null)
  // 改為只用 DOM 直接控制 touch-action，避免 React state 時序造成奇偶失敗
  // const [currentTouchAction, setCurrentTouchAction] = useState<string>("pan-x pan-y")
  const bodyOverflowPrevRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // 追蹤最新的 selectedSlots，避免 rAF/事件閉包讀到舊值
  const selectedSlotsRef = useRef<TimeSlot[]>(selectedSlots)
  const dragModeRef = useRef<"add" | "remove" | null>(null)
  const touchedCellsRef = useRef<Set<string>>(new Set())
  const pendingAddRef = useRef<Set<string>>(new Set())
  const pendingAddDetailsRef = useRef<Map<string, { date: Date; hour: number }>>(new Map())
  const pendingRemoveRef = useRef<Set<string>>(new Set())
  const rafIdRef = useRef<number | null>(null)
  // 視覺提示（拖曳啟動時）
  const [hint, setHint] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false })

  // 手機觸控起點與命中資訊
  const touchStartPointRef = useRef<{ x: number; y: number } | null>(null)
  const touchStartHitRef = useRef<{ date: Date; hour: number } | null>(null)
  // 避免行動裝置觸控結束後產生合成滑鼠事件，導致又被切換回去
  const ignoreMouseUntilRef = useRef<number>(0)
  
  // 自動邊緣滾動
  const autoScrollIntervalRef = useRef<number | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // 拖曳階段：idle（待機）| dragging（拖曳中）
  const dragPhaseRef = useRef<"idle" | "dragging">("idle")
  // 指標 ID（pointer capture 用）
  const lastPointerIdRef = useRef<number>(0)

  // 優先使用 selectedDates，否則用 startDate 到 endDate 的連續日期
  const dates: Date[] = selectedDates && selectedDates.length > 0 
    ? selectedDates.map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime())
    : (() => {
        const result: Date[] = []
        const currentDate = new Date(startDate)
        while (currentDate <= endDate) {
          result.push(new Date(currentDate))
          currentDate.setDate(currentDate.getDate() + 1)
        }
        return result
      })()

  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)

  const getSlotKey = (date: Date, hour: number) => `${date.toISOString().split("T")[0]}-${hour}`

  const isSlotSelectedBase = (date: Date, hour: number) => {
    return selectedSlots.some((slot) => slot.date.toDateString() === date.toDateString() && slot.hour === hour)
  }

  // 預覽模式下：將 pending 變更套用於畫面顯示（不提交）
  const isSlotSelectedRender = (date: Date, hour: number) => {
    const key = getSlotKey(date, hour)
    let selected = isSlotSelectedBase(date, hour)
    if (previewBeforeCommit && isDragging) {
      if (pendingRemoveRef.current.has(key)) selected = false
      if (pendingAddRef.current.has(key)) selected = true
    }
    return selected
  }

  const getHeatmapIntensity = (date: Date, hour: number) => {
    if (!heatmapData) return 0
    const key = getSlotKey(date, hour)
    const count = heatmapData.get(key) || 0
    return count / maxParticipants
  }

  const toggleSlot = (date: Date, hour: number) => {
    if (readOnly || !onSlotsChange) return
    const newSlots = isSlotSelectedBase(date, hour)
      ? selectedSlots.filter((slot) => !(slot.date.toDateString() === date.toDateString() && slot.hour === hour))
      : [...selectedSlots, { date: new Date(date), hour }]
    onSlotsChange(newSlots)
  }

  // 整欄選擇（該日期的所有時段）
  const toggleDateColumn = (date: Date) => {
    if (readOnly || !onSlotsChange) return
    // 檢查該日期是否所有時段都已選擇
    const allSelected = hours.every(h => isSlotSelectedBase(date, h))
    
    if (allSelected) {
      // 全部取消
      const newSlots = selectedSlots.filter(
        slot => slot.date.toDateString() !== date.toDateString()
      )
      onSlotsChange(newSlots)
    } else {
      // 全部選擇
      const existingSlots = selectedSlots.filter(
        slot => slot.date.toDateString() !== date.toDateString()
      )
      const newDaySlots = hours.map(h => ({ date: new Date(date), hour: h }))
      onSlotsChange([...existingSlots, ...newDaySlots])
    }
  }

  // 整列選擇（該時段的所有日期）
  const toggleHourRow = (hour: number) => {
    if (readOnly || !onSlotsChange) return
    // 檢查該時段是否所有日期都已選擇
    const allSelected = dates.every(d => isSlotSelectedBase(d, hour))
    
    if (allSelected) {
      // 全部取消
      const newSlots = selectedSlots.filter(slot => slot.hour !== hour)
      onSlotsChange(newSlots)
    } else {
      // 全部選擇
      const existingSlots = selectedSlots.filter(slot => slot.hour !== hour)
      const newHourSlots = dates.map(d => ({ date: new Date(d), hour }))
      onSlotsChange([...existingSlots, ...newHourSlots])
    }
  }

  // 全選/取消全選
  const toggleAllSlots = () => {
    if (readOnly || !onSlotsChange) return
    // 檢查是否所有時段都已選擇
    const totalSlots = dates.length * hours.length
    const allSelected = selectedSlots.length === totalSlots
    
    if (allSelected) {
      // 全部取消
      onSlotsChange([])
    } else {
      // 全部選擇
      const allSlots: TimeSlot[] = []
      dates.forEach(date => {
        hours.forEach(hour => {
          allSlots.push({ date: new Date(date), hour })
        })
      })
      onSlotsChange(allSlots)
    }
  }

  const scheduleCommit = () => {
    if (!onSlotsChange) return
    // 預覽模式中拖曳時不提交，等放手再一次性提交
    if (previewBeforeCommit && isDragging) return
    if (rafIdRef.current != null) return
    rafIdRef.current = requestAnimationFrame(() => {
      const removeKeys = pendingRemoveRef.current
      const addKeys = pendingAddRef.current
      const addDetails = pendingAddDetailsRef.current

      const base = selectedSlotsRef.current
      const selectedKeySet = new Set(base.map((s) => `${s.date.toISOString().split("T")[0]}-${s.hour}`))
      const result: TimeSlot[] = []

      // 先保留原本但排除要移除的
      for (const s of base) {
        const key = `${s.date.toISOString().split("T")[0]}-${s.hour}`
        if (!removeKeys.has(key)) {
          result.push(s)
        } else {
          selectedKeySet.delete(key)
        }
      }

      // 再加入要新增的（避免重複）
      for (const key of addKeys) {
        if (!selectedKeySet.has(key)) {
          const det = addDetails.get(key)
          if (det) {
            result.push({ date: det.date, hour: det.hour })
            selectedKeySet.add(key)
          }
        }
      }

      // 依日期與小時排序
      result.sort((a, b) => a.date.getTime() - b.date.getTime() || a.hour - b.hour)

      // 清空累積
      pendingRemoveRef.current.clear()
      pendingAddRef.current.clear()
      pendingAddDetailsRef.current.clear()
      rafIdRef.current = null

      onSlotsChange(result)
    })
  }

  const applyDragOnCell = (date: Date, hour: number) => {
    if (readOnly) return
    const key = getSlotKey(date, hour)
    if (touchedCellsRef.current.has(key)) return
    touchedCellsRef.current.add(key)

    const mode = dragModeRef.current
    if (!mode) return

    if (mode === "add") {
      pendingRemoveRef.current.delete(key)
      pendingAddRef.current.add(key)
      pendingAddDetailsRef.current.set(key, { date: new Date(date), hour })
    } else {
      pendingAddRef.current.delete(key)
      pendingAddDetailsRef.current.delete(key)
      pendingRemoveRef.current.add(key)
    }
    scheduleCommit()
  }

  const startDragAt = (date: Date, hour: number) => {
    if (readOnly) return
    
    dragPhaseRef.current = "dragging"
    
    // 先設置所有狀態
    isDraggingRef.current = true // 立即設置 ref
    setIsDragging(true)
    setDragStart({ date, hour })
    touchedCellsRef.current = new Set()
    dragModeRef.current = isSlotSelectedBase(date, hour) ? "remove" : "add"
    
    // 立即捕獲指標並禁用觸控滾動
    if (containerRef.current) {
      try { if (lastPointerIdRef.current) containerRef.current.setPointerCapture(lastPointerIdRef.current) } catch {}
      containerRef.current.style.touchAction = 'none'
    }
    if (bodyOverflowPrevRef.current == null) {
      bodyOverflowPrevRef.current = document.body.style.overflow || ''
      document.body.style.overflow = 'hidden'
    }
    
    // 震動提示
    try { 
      if ((navigator as any)?.vibrate) {
        (navigator as any).vibrate(10)
      }
    } catch {}
    
    // 顯示視覺提示
    if (touchStartPointRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setHint({ 
        x: touchStartPointRef.current.x - rect.left, 
        y: touchStartPointRef.current.y - rect.top, 
        visible: true 
      })
      window.setTimeout(() => setHint((h) => ({ ...h, visible: false })), 600)
    }
    
    onSlotFocus?.(date, hour)
    applyDragOnCell(date, hour)
  }

  // 檢查並執行自動邊緣滾動
  const checkAndAutoScroll = (clientX: number, clientY: number) => {
    if (!scrollContainerRef.current) return
    
    const scrollContainer = scrollContainerRef.current
    const rect = scrollContainer.getBoundingClientRect()
    const edgeThreshold = 50 // 距離邊緣 50px 時觸發自動滾動
    const scrollSpeed = 5 // 每次滾動的像素
    
    // 清除現有的自動滾動
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current)
      autoScrollIntervalRef.current = null
    }
    
    let scrollX = 0
    
    // 檢查水平滾動（左右邊緣）
    if (clientX < rect.left + edgeThreshold) {
      scrollX = -scrollSpeed // 向左滾動
    } else if (clientX > rect.right - edgeThreshold) {
      scrollX = scrollSpeed // 向右滾動
    }
    
    // 如果需要滾動，啟動定時器
    if (scrollX !== 0) {
      autoScrollIntervalRef.current = window.setInterval(() => {
        scrollContainer.scrollLeft += scrollX
      }, 16) // 約 60fps
    }
  }

  // 停止自動滾動
  const stopAutoScroll = () => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current)
      autoScrollIntervalRef.current = null
    }
  }

  const handleMouseDown = (date: Date, hour: number) => {
    // 防止文字選取、避免 click 產生額外副作用
    try { window.getSelection()?.removeAllRanges() } catch {}
    // 若剛經歷觸控事件，忽略隨後的合成滑鼠事件
    if (Date.now() < ignoreMouseUntilRef.current) return
    // 桌面滑鼠立即進入拖曳
    startDragAt(date, hour)
  }

  const handleMouseEnter = (date: Date, hour: number) => {
    if (!isDragging || !dragStart) return
    applyDragOnCell(date, hour)
  }

  const finishDrag = () => {
    isDraggingRef.current = false // 立即清除 ref
    setIsDragging(false)
    setDragStart(null)
    dragModeRef.current = null
    touchedCellsRef.current.clear()
    // 停止自動滾動
    stopAutoScroll()
    // 恢復觸控滾動
    if (containerRef.current) {
      containerRef.current.style.touchAction = 'pan-x pan-y'
      try { containerRef.current.releasePointerCapture(lastPointerIdRef.current) } catch {}
    }
    // 恢復 body 滾動
    if (bodyOverflowPrevRef.current != null) {
  document.body.style.overflow = bodyOverflowPrevRef.current ?? ''
      bodyOverflowPrevRef.current = null
    }
    // 放手時提交（預覽模式亦在此提交）
    scheduleCommit()
  }

  useEffect(() => {
    const handleGlobalMouseUp = () => finishDrag()
    document.addEventListener("mouseup", handleGlobalMouseUp)
    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp)
      // 清理自動滾動
      stopAutoScroll()
    }
  }, [])

  // 追蹤最新的 selectedSlots 供 rAF 使用，避免閉包讀到舊值
  useEffect(() => {
    selectedSlotsRef.current = selectedSlots
  }, [selectedSlots])

  // 由座標找到 cell
  const getCellFromPoint = (clientX: number, clientY: number): { date: Date; hour: number } | null => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
    if (!el) return null
    const cell = el.closest('[data-date-idx][data-hour]') as HTMLElement | null
    if (!cell) return null
    const dateIdx = Number(cell.getAttribute('data-date-idx'))
    const hour = Number(cell.getAttribute('data-hour'))
    if (Number.isNaN(dateIdx) || Number.isNaN(hour)) return null
    const date = dates[dateIdx]
    return date ? { date, hour } : null
  }

  // pointer 事件（手機）
  const pointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || e.pointerType !== 'touch') return
    
    const hit = getCellFromPoint(e.clientX, e.clientY)
    if (!hit) return
    
    // 設定一段時間忽略隨後的合成滑鼠事件
    ignoreMouseUntilRef.current = Date.now() + 600
    
    // 阻止預設行為，避免瀏覽器啟動滾動手勢
    e.preventDefault()
    
    // 記錄觸控起點
    touchStartPointRef.current = { x: e.clientX, y: e.clientY }
    touchStartHitRef.current = hit
    lastPointerIdRef.current = e.pointerId
    
    // 等待 pointerMove 判斷是拖曳還是單擊
  }

  const pointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || e.pointerType !== 'touch') return
    
    // 已在拖曳中：持續塗抹
    if (isDraggingRef.current && dragPhaseRef.current === 'dragging') {
      e.preventDefault()
      e.stopPropagation()
      
      const hit = getCellFromPoint(e.clientX, e.clientY)
      if (hit) {
        applyDragOnCell(hit.date, hit.hour)
      }
      // 檢查是否需要自動邊緣滾動
      checkAndAutoScroll(e.clientX, e.clientY)
      return
    }

    // 尚未啟動拖曳，檢查移動距離
    if (touchStartPointRef.current && touchStartHitRef.current && !isDraggingRef.current) {
      const dx = Math.abs(e.clientX - touchStartPointRef.current.x)
      const dy = Math.abs(e.clientY - touchStartPointRef.current.y)
      
      // 移動超過 5px：進入拖曳模式
      if (dx >= 5 || dy >= 5) {
        e.preventDefault()
        e.stopPropagation()
        startDragAt(touchStartHitRef.current.date, touchStartHitRef.current.hour)
      }
    }
  }

  const pointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return

    // 正在拖曳：結束並提交
    if (isDraggingRef.current && dragPhaseRef.current === 'dragging') {
      finishDrag()
      touchStartHitRef.current = null
      touchStartPointRef.current = null
      return
    }

    // 未進入拖曳（移動距離 < 5px）=> 當作單擊切換
    if (touchStartHitRef.current && !isDraggingRef.current) {
      const hit = touchStartHitRef.current
      toggleSlot(hit.date, hit.hour)
      onSlotFocus?.(hit.date, hit.hour)
      touchStartHitRef.current = null
      touchStartPointRef.current = null
      return
    }

    // 清理
    dragPhaseRef.current = 'idle'
    touchStartHitRef.current = null
    touchStartPointRef.current = null
  }

  const pointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return
    
    // 若正在拖曳，當作放手結束
    if (isDraggingRef.current && dragPhaseRef.current === 'dragging') {
      finishDrag()
    } else {
      // 非拖曳情境：確保釋放 capture 與觸控還原
      if (containerRef.current) {
        try { containerRef.current.releasePointerCapture(lastPointerIdRef.current) } catch {}
        containerRef.current.style.touchAction = 'pan-x pan-y'
      }
      if (bodyOverflowPrevRef.current != null) {
        document.body.style.overflow = bodyOverflowPrevRef.current ?? ''
        bodyOverflowPrevRef.current = null
      }
    }
    dragPhaseRef.current = 'idle'
    touchStartHitRef.current = null
    touchStartPointRef.current = null
  }

  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

  const totalSlots = dates.length * hours.length
  const allSelected = selectedSlots.length === totalSlots

  return (
    <div className="w-full max-w-full lg:max-w-5xl mx-auto">
      {/* 全選/取消全選按鈕 */}
      {!readOnly && onSlotsChange && (
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={toggleAllSlots}
            className="px-4 py-2 text-sm font-medium rounded-md border transition-colors hover:bg-muted"
            title={allSelected ? "點擊取消所有時段" : "點擊選擇所有時段"}
          >
            {allSelected ? "✓ 取消全選" : "全選所有時段"}
          </button>
          {selectedSlots.length > 0 && (
            <span className="text-sm text-muted-foreground">
              已選擇 {selectedSlots.length} / {totalSlots} 個時段
            </span>
          )}
        </div>
      )}

      {heatmapData && (
        <div className="mb-4 flex items-center gap-4 text-sm flex-wrap">
          <span className="font-medium">{t("calendar.availability")}:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500/20 border border-green-500/30 rounded" />
            <span className="text-muted-foreground">{t("calendar.low")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500/50 border border-green-500/60 rounded" />
            <span className="text-muted-foreground">{t("calendar.medium")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 border border-green-600 rounded" />
            <span className="text-muted-foreground">{t("calendar.high")}</span>
          </div>
        </div>
      )}

      <div ref={scrollContainerRef} className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div
          ref={containerRef}
          className="inline-block min-w-full border rounded-lg overflow-hidden relative [--time-col:56px] md:[--time-col:56px] lg:[--time-col:48px] select-none"
          style={{ minWidth: dates.length > 3 ? "720px" : "auto" }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerCancel}
        >
          {/* 長按進入拖曳的淡出提示圈 */}
          {hint.visible && (
            <div className="pointer-events-none absolute inset-0 z-20">
              <div
                className="absolute w-6 h-6 rounded-full bg-primary/20 ring-2 ring-primary/60 animate-ping"
                style={{ left: hint.x, top: hint.y, transform: "translate(-50%, -50%)" }}
              />
            </div>
          )}

          <div className="grid" style={{ gridTemplateColumns: `var(--time-col) repeat(${dates.length}, 1fr)` }}>
            <div className="bg-muted border-b border-r p-2 text-xs font-medium sticky left-0 z-10" />
            {dates.map((date, i) => {
              const allSelected = hours.every(h => isSlotSelectedBase(date, h))
              return (
                <div 
                  key={i} 
                  className={cn(
                    "bg-muted border-b p-2 text-center text-xs font-medium cursor-pointer hover:bg-muted/80 transition-colors",
                    allSelected && "bg-primary/10"
                  )}
                  onClick={() => !readOnly && toggleDateColumn(date)}
                  title={allSelected ? "點擊取消此日所有時段" : "點擊選擇此日所有時段"}
                >
                  <div className="hidden sm:block">{t(`calendar.${dayNames[date.getDay()]}`)}</div>
                  <div className="sm:hidden">{t(`calendar.${dayNames[date.getDay()]}`).slice(0, 1)}</div>
                  <div className="text-muted-foreground mt-1">
                    {date.getMonth() + 1}/{date.getDate()}
                  </div>
                </div>
              )
            })}

            {hours.map((hour) => {
              const allSelected = dates.every(d => isSlotSelectedBase(d, hour))
              return (
                <div key={hour} className="contents">
                  <div 
                    className={cn(
                      "bg-muted border-r p-1.5 lg:p-1 text-[10px] sm:text-xs font-medium text-center sticky left-0 z-10 cursor-pointer hover:bg-muted/80 transition-colors",
                      allSelected && "bg-primary/10"
                    )}
                    onClick={() => !readOnly && toggleHourRow(hour)}
                    title={allSelected ? "點擊取消此時段所有日期" : "點擊選擇此時段所有日期"}
                  >
                    {hour.toString().padStart(2, "0")}:00
                  </div>
                {dates.map((date, i) => {
                  const key = getSlotKey(date, hour)
                  const selected = isSlotSelectedRender(date, hour)
                  const baseSelected = isSlotSelectedBase(date, hour)
                  const intensity = getHeatmapIntensity(date, hour)
                  const showHeatmap = heatmapData && intensity > 0
                  const hasOverlap = selected && showHeatmap  // 自己選取且有他人也選

                  const previewAdd = previewBeforeCommit && isDragging && pendingAddRef.current.has(key)
                  const previewRemove = previewBeforeCommit && isDragging && pendingRemoveRef.current.has(key)

                  return (
                    <div
                      key={`${i}-${hour}`}
                      className={cn(
                        "border-b border-r p-1 sm:p-1.5 lg:p-1 cursor-pointer transition-colors min-h-[28px] sm:min-h-[34px] lg:min-h-[28px] relative",
                        readOnly && "cursor-default",
                        !readOnly && "hover:bg-accent",
                        selected && !showHeatmap && "bg-primary/60 md:bg-primary/40 hover:bg-primary/50 ring-2 ring-primary/80",
                        showHeatmap && !selected && "bg-green-500 hover:bg-green-600",
                        hasOverlap && "bg-gradient-to-br from-primary/70 to-green-500/70 ring-2 ring-primary ring-offset-1",
                        previewAdd && !baseSelected && "ring-2 ring-dashed ring-primary/80",
                        previewRemove && baseSelected && "ring-2 ring-dashed ring-red-500/80"
                      )}
                      style={showHeatmap && !selected ? { opacity: 0.2 + intensity * 0.8 } : undefined}
                      data-date-idx={i}
                      data-hour={hour}
                      onMouseDown={() => handleMouseDown(date, hour)}
                      onMouseEnter={() => handleMouseEnter(date, hour)}
                      onClick={() => onSlotFocus?.(date, hour)}
                    >
                      {hasOverlap && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-xs sm:text-sm font-bold text-white drop-shadow-lg">✓</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              )
            })}
          </div>
        </div>
      </div>
      {/* Mobile selected count feedback */}
      {selectedSlots.length > 0 && (
        <div className="sm:hidden mt-2 text-xs text-primary font-medium">{t("event.selectedCount")}: {selectedSlots.length}</div>
      )}
    </div>
  )
}
