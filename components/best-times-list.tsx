"use client"

import { useState } from "react"
import type { TimeSlot, Participant } from "@/lib/types"
import { useLanguage } from "@/lib/i18n/language-context"
import { Card } from "@/components/ui/card"
import { Clock, ChevronDown, ChevronUp, Users } from "lucide-react"

interface BestTimesListProps {
  participants: Participant[]
  startHour: number
  endHour: number
}

export function BestTimesList({ participants, startHour, endHour }: BestTimesListProps) {
  const { t } = useLanguage()
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const calculateBestTimes = () => {
    if (participants.length === 0) return []

    const slotCounts = new Map<string, { slot: TimeSlot; count: number; participants: Participant[] }>()

    participants.forEach((participant) => {
      participant.availability.forEach((slot) => {
        const key = `${slot.date.toISOString().split("T")[0]}-${slot.hour}`
        const existing = slotCounts.get(key)
        if (existing) {
          existing.count++
          existing.participants.push(participant)
        } else {
          slotCounts.set(key, { slot, count: 1, participants: [participant] })
        }
      })
    })

    return Array.from(slotCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  const bestTimes = calculateBestTimes()

  if (bestTimes.length === 0) {
    return (
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col items-center justify-center text-center py-8">
          <Clock className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("event.noBestTimes")}</p>
        </div>
      </Card>
    )
  }

  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index)
  }

  return (
    <Card className="p-4 sm:p-6">
      <h3 className="font-semibold text-lg mb-4">{t("event.bestTimes")}</h3>
      <div className="space-y-2">
        {bestTimes.map(({ slot, count, participants: availableParticipants }, index) => {
          const isExpanded = expandedIndex === index
          return (
            <div key={index} className="rounded-lg bg-muted/50 overflow-hidden">
              <button
                onClick={() => toggleExpand(index)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/70 transition-colors"
              >
                <div className="flex-1 text-left">
                  <p className="font-medium">
                    {t(`calendar.${dayNames[slot.date.getDay()]}`)}
                    {", "}
                    {slot.date.getMonth() + 1}/{slot.date.getDate()}
                    {" - "}
                    {slot.hour.toString().padStart(2, "0")}:00
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {count}/{participants.length}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">
                    {t("event.availableParticipants")}:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableParticipants.map((participant, pIndex) => (
                      <span
                        key={pIndex}
                        className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-xs font-medium"
                      >
                        {participant.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
