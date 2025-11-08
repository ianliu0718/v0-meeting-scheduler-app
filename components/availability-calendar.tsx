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
}: AvailabilityCalendarProps) {
  const { t } = useLanguage()
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ date: Date; hour: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

  const isSlotSelected = (date: Date, hour: number) => {
    return selectedSlots.some((slot) => slot.date.toDateString() === date.toDateString() && slot.hour === hour)
  }

  const getSlotKey = (date: Date, hour: number) => {
    return `${date.toISOString().split("T")[0]}-${hour}`
  }

  const getHeatmapIntensity = (date: Date, hour: number) => {
    if (!heatmapData) return 0
    const key = getSlotKey(date, hour)
    const count = heatmapData.get(key) || 0
    return count / maxParticipants
  }

  const toggleSlot = (date: Date, hour: number) => {
    if (readOnly || !onSlotsChange) return

    const newSlots = isSlotSelected(date, hour)
      ? selectedSlots.filter((slot) => !(slot.date.toDateString() === date.toDateString() && slot.hour === hour))
      : [...selectedSlots, { date: new Date(date), hour }]

    onSlotsChange(newSlots)
  }

  const handleMouseDown = (date: Date, hour: number) => {
    if (readOnly) return
    setIsDragging(true)
    setDragStart({ date, hour })
    onSlotFocus?.(date, hour)
    toggleSlot(date, hour)
  }

  const handleMouseEnter = (date: Date, hour: number) => {
    if (!isDragging || !dragStart) return
    toggleSlot(date, hour)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDragStart(null)
  }

  useEffect(() => {
    const handleGlobalMouseUp = () => handleMouseUp()
    document.addEventListener("mouseup", handleGlobalMouseUp)
    return () => document.removeEventListener("mouseup", handleGlobalMouseUp)
  }, [])

  // Touch handlers for mobile drag selection
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

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (readOnly) return
    const t = e.touches[0]
    if (!t) return
    const hit = getCellFromPoint(t.clientX, t.clientY)
    if (!hit) return
    e.preventDefault()
    handleMouseDown(hit.date, hit.hour)
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || readOnly) return
    const t = e.touches[0]
    if (!t) return
    const hit = getCellFromPoint(t.clientX, t.clientY)
    if (!hit) return
    e.preventDefault()
    handleMouseEnter(hit.date, hit.hour)
  }

  const handleTouchEnd = () => {
    handleMouseUp()
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
          className="inline-block min-w-full border rounded-lg overflow-hidden [--time-col:56px] md:[--time-col:56px] lg:[--time-col:48px] touch-none"
          style={{ minWidth: dates.length > 3 ? "720px" : "auto" }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
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
                  const selected = isSlotSelected(date, hour)
                  const intensity = getHeatmapIntensity(date, hour)
                  const showHeatmap = heatmapData && intensity > 0
                  const hasOverlap = selected && showHeatmap  // 自己選取且有他人也選

                  return (
                    <div
                      key={`${i}-${hour}`}
                      className={cn(
                        "border-b border-r p-1 sm:p-1.5 lg:p-1 cursor-pointer transition-colors min-h-[28px] sm:min-h-[34px] lg:min-h-[28px] relative",
                        readOnly && "cursor-default",
                        !readOnly && "hover:bg-accent",
                        selected && !showHeatmap && "bg-primary/60 md:bg-primary/40 hover:bg-primary/50 ring-2 ring-primary/80",
                        showHeatmap && !selected && "bg-green-500 hover:bg-green-600",
                        hasOverlap && "bg-gradient-to-br from-primary/70 to-green-500/70 ring-2 ring-primary ring-offset-1"
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
