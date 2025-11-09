"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { format, addDays, startOfWeek, isSameDay, isBefore } from "date-fns"

interface MultiDatePickerProps {
  value: Date[]
  onChange: (dates: Date[]) => void
}

export function MultiDatePicker({ value, onChange }: MultiDatePickerProps) {
  const { t } = useLanguage()
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    return startOfWeek(today, { weekStartsOn: 0 })
  })

  const weekDays = [
    t("calendar.sun"),
    t("calendar.mon"),
    t("calendar.tue"),
    t("calendar.wed"),
    t("calendar.thu"),
    t("calendar.fri"),
    t("calendar.sat"),
  ]

  const generateDates = () => {
    const dates: Date[] = []
    for (let i = 0; i < 35; i++) {
      dates.push(addDays(currentWeekStart, i))
    }
    return dates
  }

  const dates = generateDates()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Drag-to-select state
  const [isDragging, setIsDragging] = useState(false)
  const dragStartIndex = useRef<number | null>(null)
  const originSelectionRef = useRef<Date[]>([])
  const hasDragged = useRef(false)  // 追蹤是否真的拖曳過

  // 手機觸控拖曳支援
  const getCellIndexFromPoint = (clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
    if (!el) return null
    const cell = el.closest('[data-date-index]') as HTMLElement | null
    if (!cell) return null
    const idx = Number(cell.getAttribute('data-date-index'))
    return Number.isNaN(idx) ? null : idx
  }

  const toggleDate = (date: Date) => {
    const dateWithoutTime = new Date(date)
    dateWithoutTime.setHours(0, 0, 0, 0)

    const isSelected = value.some((d) => isSameDay(d, dateWithoutTime))

    if (isSelected) {
      onChange(value.filter((d) => !isSameDay(d, dateWithoutTime)))
    } else {
      onChange([...value, dateWithoutTime].sort((a, b) => a.getTime() - b.getTime()))
    }
  }

  const clearAll = () => {
    onChange([])
  }

  const goToPreviousWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7))
  }

  const goToNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7))
  }

  const dateEquals = (a: Date, b: Date) => isSameDay(a, b)
  const uniqByDay = (arr: Date[]) => {
    const result: Date[] = []
    arr.forEach((d) => {
      if (!result.some((x) => dateEquals(x, d))) result.push(d)
    })
    return result
  }

  const handleMouseDown = (index: number) => {
    const date = dates[index]
    if (isBefore(date, today)) return
    setIsDragging(true)
    dragStartIndex.current = index
    originSelectionRef.current = [...value]
    hasDragged.current = false  // 重置拖曳標記
  }

  const handleMouseEnter = (index: number) => {
    if (!isDragging || dragStartIndex.current === null) return
    hasDragged.current = true  // 標記為已拖曳
    const start = Math.min(dragStartIndex.current, index)
    const end = Math.max(dragStartIndex.current, index)
    const range = dates.slice(start, end + 1).filter((d) => !isBefore(d, today))
    onChange(uniqByDay([...originSelectionRef.current, ...range]).sort((a, b) => a.getTime() - b.getTime()))
  }

  // Pointer 事件（支援觸控與滑鼠）
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, index: number) => {
    handleMouseDown(index)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || dragStartIndex.current === null) return
    const idx = getCellIndexFromPoint(e.clientX, e.clientY)
    if (idx !== null && idx !== dragStartIndex.current) {
      hasDragged.current = true
      const start = Math.min(dragStartIndex.current, idx)
      const end = Math.max(dragStartIndex.current, idx)
      const range = dates.slice(start, end + 1).filter((d) => !isBefore(d, today))
      onChange(uniqByDay([...originSelectionRef.current, ...range]).sort((a, b) => a.getTime() - b.getTime()))
    }
  }

  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false)
      dragStartIndex.current = null
    }
  }

  useEffect(() => {
    const onUp = () => {
      if (isDragging) {
        setIsDragging(false)
        dragStartIndex.current = null
      }
    }
    window.addEventListener('mouseup', onUp)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('pointerup', onUp)
    }
  }, [isDragging])

  return (
    <Card className="p-4 sm:p-6">
      <div className="space-y-4">
        {/* Header with navigation */}
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-semibold">{t("create.dateRanges")}</h3>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goToPreviousWeek}
              className="h-8 w-8 p-0 bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 34), "MMM d, yyyy")}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goToNextWeek}
              className="h-8 w-8 p-0 bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="space-y-2">
          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {weekDays.map((day, index) => (
              <div key={index} className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Date cells - 5 weeks */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 touch-none" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
            {dates.map((date, index) => {
              const isSelected = value.some((d) => isSameDay(d, date))
              const isPast = isBefore(date, today)
              const isToday = isSameDay(date, today)

              return (
                <button
                  key={index}
                  type="button"
                  data-date-index={index}
                  onMouseDown={() => handleMouseDown(index)}
                  onMouseEnter={() => handleMouseEnter(index)}
                  onPointerDown={(e) => handlePointerDown(e, index)}
                  onClick={() => {
                    if (!isPast && !hasDragged.current) {
                      toggleDate(date)
                    }
                  }}
                  disabled={isPast}
                  className={`
                    aspect-square rounded-lg text-sm sm:text-base font-medium
                    transition-all duration-200
                    ${isPast ? "text-muted-foreground/30 cursor-not-allowed" : "hover:border-primary/50"}
                    ${isSelected ? "bg-primary text-primary-foreground shadow-md scale-105" : "bg-muted/30"}
                    ${isToday && !isSelected ? "border-2 border-primary" : "border border-transparent"}
                  `}
                >
                  {format(date, "d")}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected dates display - single-row, horizontally scrollable chips */}
        {value.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {t("create.selectedDates")}: {value.length}
            </span>
            <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
              <div className="inline-flex gap-2 flex-nowrap">
                {value.map((date, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded text-xs whitespace-nowrap"
                  >
                    <span>{format(date, "MMM d")}</span>
                    <button type="button" onClick={() => toggleDate(date)} className="hover:bg-primary/20 rounded p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs whitespace-nowrap">
              {t("create.clearAll")}
            </Button>
          </div>
        )}

        {/* Hint text */}
        <p className="text-xs sm:text-sm text-muted-foreground text-center">{t("create.datePickerHint")}</p>
      </div>
    </Card>
  )
}
