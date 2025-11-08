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
  const [dragStart, setDragStart] = useState<{ date: Date; hour: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragModeRef = useRef<"add" | "remove" | null>(null)
  const touchedCellsRef = useRef<Set<string>>(new Set())
  const pendingAddRef = useRef<Set<string>>(new Set())
  const pendingAddDetailsRef = useRef<Map<string, { date: Date; hour: number }>>(new Map())
  const pendingRemoveRef = useRef<Set<string>>(new Set())
  const rafIdRef = useRef<number | null>(null)
  // 視覺提示（長按進入拖曳時）
  const [hint, setHint] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false })

  // 手機長按相關
  const longPressTimerRef = useRef<number | null>(null)
  const awaitingLongPressRef = useRef(false)
  const touchStartPointRef = useRef<{ x: number; y: number } | null>(null)
  const touchStartHitRef = useRef<{ date: Date; hour: number } | null>(null)

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

  const scheduleCommit = () => {
    if (!onSlotsChange) return
    // 預覽模式中拖曳時不提交，等放手再一次性提交
    if (previewBeforeCommit && isDragging) return
    if (rafIdRef.current != null) return
    rafIdRef.current = requestAnimationFrame(() => {
      const removeKeys = pendingRemoveRef.current
      const addKeys = pendingAddRef.current
      const addDetails = pendingAddDetailsRef.current

      const selectedKeySet = new Set(selectedSlots.map((s) => `${s.date.toISOString().split("T")[0]}-${s.hour}`))
      const result: TimeSlot[] = []

      // 先保留原本但排除要移除的
      for (const s of selectedSlots) {
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
    setIsDragging(true)
    setDragStart({ date, hour })
    touchedCellsRef.current = new Set()
    dragModeRef.current = isSlotSelectedBase(date, hour) ? "remove" : "add"
    onSlotFocus?.(date, hour)
    applyDragOnCell(date, hour)
  }

  const handleMouseDown = (date: Date, hour: number) => {
    // 桌面滑鼠立即進入拖曳
    startDragAt(date, hour)
  }

  const handleMouseEnter = (date: Date, hour: number) => {
    if (!isDragging || !dragStart) return
    applyDragOnCell(date, hour)
  }

  const finishDrag = () => {
    setIsDragging(false)
    setDragStart(null)
    dragModeRef.current = null
    touchedCellsRef.current.clear()
    // 放手時提交（預覽模式亦在此提交）
    scheduleCommit()
  }

  useEffect(() => {
    const handleGlobalMouseUp = () => finishDrag()
    document.addEventListener("mouseup", handleGlobalMouseUp)
    return () => document.removeEventListener("mouseup", handleGlobalMouseUp)
  }, [])

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

    touchStartPointRef.current = { x: e.clientX, y: e.clientY }
    touchStartHitRef.current = hit

    if (longPressToDrag) {
      awaitingLongPressRef.current = true
      longPressTimerRef.current = window.setTimeout(() => {
        awaitingLongPressRef.current = false
        longPressTimerRef.current = null
        // 震動提示（若支援）
        try { (navigator as any)?.vibrate?.(10) } catch {}
        // 顯示淡出提示圈
        if (touchStartPointRef.current && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          setHint({ x: touchStartPointRef.current.x - rect.left, y: touchStartPointRef.current.y - rect.top, visible: true })
          window.setTimeout(() => setHint((h) => ({ ...h, visible: false })), 600)
        }
        startDragAt(hit.date, hit.hour)
      }, Math.max(200, Math.min(300, longPressDelayMs)))
    } else {
      startDragAt(hit.date, hit.hour)
    }
  }

  const pointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || e.pointerType !== 'touch') return
    const hit = getCellFromPoint(e.clientX, e.clientY)
    if (!hit) return

    if (isDragging) {
      applyDragOnCell(hit.date, hit.hour)
      return
    }

    // 長按等待期間：若主要是水平移動則取消長按等待（讓使用者可以滑動捲動）
    if (awaitingLongPressRef.current && touchStartPointRef.current) {
      const dx = e.clientX - touchStartPointRef.current.x
      const dy = e.clientY - touchStartPointRef.current.y
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        if (longPressTimerRef.current != null) {
          clearTimeout(longPressTimerRef.current)
          longPressTimerRef.current = null
        }
        awaitingLongPressRef.current = false
      }
    }
  }

  const pointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return

    // 若正在等待長按且未進入拖曳 => 當作單擊切換
    if (awaitingLongPressRef.current && touchStartHitRef.current) {
      if (longPressTimerRef.current != null) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
      awaitingLongPressRef.current = false
      const hit = touchStartHitRef.current
      toggleSlot(hit.date, hit.hour)
      onSlotFocus?.(hit.date, hit.hour)
      touchStartHitRef.current = null
      touchStartPointRef.current = null
      return
    }

    // 正在拖曳：結束並提交
    if (isDragging) {
      finishDrag()
    }

    touchStartHitRef.current = null
    touchStartPointRef.current = null
  }

  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

  return (
    <div className="w-full max-w-full lg:max-w-5xl mx-auto">
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

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div
          ref={containerRef}
          className="inline-block min-w-full border rounded-lg overflow-hidden relative [--time-col:56px] md:[--time-col:56px] lg:[--time-col:48px] touch-pan-x select-none"
          style={{ minWidth: dates.length > 3 ? "720px" : "auto" }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
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
            {dates.map((date, i) => (
              <div key={i} className="bg-muted border-b p-2 text-center text-xs font-medium">
                <div className="hidden sm:block">{t(`calendar.${dayNames[date.getDay()]}`)}</div>
                <div className="sm:hidden">{t(`calendar.${dayNames[date.getDay()]}`).slice(0, 1)}</div>
                <div className="text-muted-foreground mt-1">
                  {date.getMonth() + 1}/{date.getDate()}
                </div>
              </div>
            ))}

            {hours.map((hour) => (
              <div key={hour} className="contents">
                <div className="bg-muted border-r p-1.5 lg:p-1 text-[10px] sm:text-xs font-medium text-center sticky left-0 z-10">
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
            ))}
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
