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

  useEffect(() => {
    const onUp = () => {
      if (isDragging) {
        setIsDragging(false)
        dragStartIndex.current = null
      }
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
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

        {/* Selected dates display */}
        {value.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground self-center">
              {t("create.selectedDates")}: {value.length}
            </span>
            <div className="flex flex-wrap gap-2 flex-1">
              {value.slice(0, 5).map((date, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded text-xs"
                >
                  <span>{format(date, "MMM d")}</span>
                  <button type="button" onClick={() => toggleDate(date)} className="hover:bg-primary/20 rounded p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {value.length > 5 && (
                <span className="text-xs text-muted-foreground self-center">
                  +{value.length - 5} {t("create.moreDates")}
                </span>
              )}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="h-7 text-xs">
              {t("create.clearAll")}
            </Button>
          </div>
        )}

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
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {dates.map((date, index) => {
              const isSelected = value.some((d) => isSameDay(d, date))
              const isPast = isBefore(date, today)
              const isToday = isSameDay(date, today)

              return (
                <button
                  key={index}
                  type="button"
                  onMouseDown={() => handleMouseDown(index)}
                  onMouseEnter={() => handleMouseEnter(index)}
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

        {/* Hint text */}
        <p className="text-xs sm:text-sm text-muted-foreground text-center">{t("create.datePickerHint")}</p>
      </div>
    </Card>
  )
}
