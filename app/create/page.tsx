"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { createEvent } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MultiDatePicker } from "@/components/multi-date-picker"

const timezones = [
  { value: "Asia/Taipei", label: "Asia/Taipei (GMT+8)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (GMT+9)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (GMT+8)" },
  { value: "Asia/Hong_Kong", label: "Asia/Hong_Kong (GMT+8)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (GMT+8)" },
  { value: "Asia/Manila", label: "Asia/Manila (GMT+8)" },
  { value: "Asia/Jakarta", label: "Asia/Jakarta (GMT+7)" },
  { value: "America/New_York", label: "America/New_York (GMT-5)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (GMT-8)" },
  { value: "Europe/London", label: "Europe/London (GMT+0)" },
  { value: "Europe/Paris", label: "Europe/Paris (GMT+1)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (GMT+11)" },
]

interface DateRange {
  start: Date
  end: Date
}

export default function CreateEventPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    selectedDates: [] as Date[],
    startHour: "9",
    endHour: "17",
    timezone: "Asia/Taipei",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.selectedDates.length === 0) {
      alert(t("create.selectDateRange"))
      return
    }

    setLoading(true)

    try {
      const eventId = Math.random().toString(36).substring(2, 15)

      // derive start/end date from selected dates
      const sortedDates = [...formData.selectedDates]
        .map((d) => new Date(new Date(d).setHours(0, 0, 0, 0)))
        .sort((a, b) => a.getTime() - b.getTime())
      const startDate = sortedDates[0]
      const endDate = sortedDates[sortedDates.length - 1]

      const eventData = {
        id: eventId,
        title: formData.title,
        description: formData.description,
        selected_dates: sortedDates,
        start_date: startDate,
        end_date: endDate,
        start_hour: Number.parseInt(formData.startHour),
        end_hour: Number.parseInt(formData.endHour),
        timezone: formData.timezone,
        created_at: new Date(),
      }

      // 寫入 Supabase
      await createEvent({
        id: eventId,
        title: eventData.title,
        description: eventData.description,
        start_date: startDate,
        end_date: endDate,
        selected_dates: sortedDates,  // 傳入不連續日期
        start_hour: eventData.start_hour,
        end_hour: eventData.end_hour,
        timezone: eventData.timezone,
        duration: 60, // 必填，或可由 UI 傳入
      })
      router.push(`/event/${eventId}`)
    } catch (error) {
      console.error("[v0] Error creating event:", error)
      alert(t("common.error"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 max-w-4xl">
        <div className="mb-8 sm:mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 text-balance">{t("create.title")}</h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            {t("create.subtitle")}
          </p>
        </div>

        <Card className="p-6 sm:p-8 lg:p-10 shadow-lg border-2">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <Label htmlFor="title" className="text-base font-medium">
                {t("create.eventName")}
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t("create.eventNamePlaceholder")}
                required
                className="text-base h-12"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="description" className="text-base font-medium">
                {t("create.description")}
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("create.descriptionPlaceholder")}
                rows={4}
                className="text-base resize-none"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">{t("create.dateRanges")}</Label>
              <p className="text-sm text-muted-foreground">{t("create.dateRangesHint")}</p>
              <MultiDatePicker
                value={formData.selectedDates}
                onChange={(dates) => setFormData({ ...formData, selectedDates: dates })}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">{t("create.timeRange")}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startHour" className="text-sm text-muted-foreground">
                    {t("create.startTime")}
                  </Label>
                  <Select
                    value={formData.startHour}
                    onValueChange={(value) => setFormData({ ...formData, startHour: value })}
                  >
                    <SelectTrigger id="startHour" className="text-base h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i.toString().padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endHour" className="text-sm text-muted-foreground">
                    {t("create.endTime")}
                  </Label>
                  <Select
                    value={formData.endHour}
                    onValueChange={(value) => setFormData({ ...formData, endHour: value })}
                  >
                    <SelectTrigger id="endHour" className="text-base h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i.toString().padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="timezone" className="text-base font-medium">
                {t("create.timezone")}
              </Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => setFormData({ ...formData, timezone: value })}
              >
                <SelectTrigger id="timezone" className="text-base h-12">
                  <SelectValue placeholder={t("create.selectTimezone")} />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full text-base h-12 font-medium" disabled={loading}>
              {loading ? t("create.creating") : t("create.submit")}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
