"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { useLanguage } from "@/lib/i18n/language-context"
import { getEvent, getParticipants, upsertParticipant } from "@/lib/db"
import { createClient } from "@/lib/supabase/client"
import type { Event, Participant, TimeSlot } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { AvailabilityCalendar } from "@/components/availability-calendar"
import { ParticipantList } from "@/components/participant-list"
import { BestTimesList } from "@/components/best-times-list"
import { Copy, Check } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import QRCode from "react-qr-code"

export default function EventPage() {
  const { t } = useLanguage()
  const params = useParams()
  const searchParams = useSearchParams()
  const eventId = params.id as string

  const [event, setEvent] = useState<Event | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [subscribed, setSubscribed] = useState(false)
  const [name, setName] = useState("")
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([])
  const [lockName, setLockName] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [password, setPassword] = useState("")
  const [focusSlot, setFocusSlot] = useState<{ date: Date; hour: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activityFeed, setActivityFeed] = useState<Array<{text:string; time:Date}>>([])
  const refreshTimer = useRef<NodeJS.Timeout | null>(null)

  // 已移除「長按拖曳 / 預覽提交」選項，統一採用即時拖曳提交行為

  // Supabase Realtime 訂閱 participants 表
  useEffect(() => {
    let isMounted = true
    async function fetchAll() {
      const evt = await getEvent(eventId)
      if (isMounted) setEvent(evt)
      const parts = await getParticipants(eventId)
      if (isMounted) setParticipants(parts)
    }
    fetchAll()
    if (!subscribed) {
      const supabase = createClient()
      const channel = supabase.channel(`participants-${eventId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `event_id=eq.${eventId}`,
        }, (payload: any) => {
          // 即時更新 + 若為新增參與者顯示 Toast
          fetchAll()
          try {
            if (payload.eventType === 'INSERT' && payload.new?.name) {
              toast({ title: t('common.update'), description: `${payload.new.name} ${t('event.submit')}` })
            }
            // 活動動態列表（不需重新整理也能看到變更）
            const now = new Date()
            if (payload.eventType === 'INSERT') {
              const n = payload.new?.name || '參與者'
              setActivityFeed(prev => ([{ text: `${n} 已加入`, time: now }, ...prev]).slice(0, 30))
            } else if (payload.eventType === 'UPDATE') {
              const n = payload.new?.name || '參與者'
              setActivityFeed(prev => ([{ text: `${n} 已更新可出席時段`, time: now }, ...prev]).slice(0, 30))
            } else if (payload.eventType === 'DELETE') {
              const n = payload.old?.name || '參與者'
              setActivityFeed(prev => ([{ text: `${n} 已移除`, time: now }, ...prev]).slice(0, 30))
            }
          } catch {}
        })
        .subscribe()
      setSubscribed(true)
      return () => {
        channel.unsubscribe()
        isMounted = false
      }
    }
    return () => { isMounted = false }
  }, [eventId, subscribed])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 純 Realtime 模式：不再註冊或使用推播/Service Worker

  // 移除推播相關函式（enablePush/urlBase64ToUint8Array）

  // 不再提供手動測試與重設按鈕；若需要重設可重新載入 + 點啟用通知

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || selectedSlots.length === 0) return
    
    // 如果要鎖定名稱但未輸入密碼
    if (lockName && !password.trim()) {
      alert(t("event.passwordRequired"))
      return
    }
    
    setLoading(true)
    try {
      const { isNew } = await upsertParticipant(eventId, {
        name: name.trim(),
        availability: selectedSlots,
        lock: lockName,
        password: lockName ? password.trim() : undefined,
      })
      setName("")
      setPassword("")
      setSelectedSlots([])
      setLockName(false)
      // 送出後立即刷新
      const parts = await getParticipants(eventId)
      setParticipants(parts)
      // 純 Realtime 模式：不再呼叫推播 API
      alert(t("common.success"))
    } catch (error) {
      console.error("[v0] Error submitting availability:", error)
      if ((error as Error).message === 'NAME_LOCKED') {
        alert(t('event.nameLocked'))
      } else {
        alert(t("common.error"))
      }
    } finally {
      setLoading(false)
    }
  }

  

  const getHeatmapData = () => {
    const heatmap: Map<string, number> = new Map()
    participants.forEach((participant: Participant) => {
      participant.availability.forEach((slot: TimeSlot) => {
        const key = `${slot.date.toISOString().split("T")[0]}-${slot.hour}`
        heatmap.set(key, (heatmap.get(key) || 0) + 1)
      })
    })
    return heatmap
  }

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 text-balance">{event.title}</h1>
          {event.description && (
            <p className="text-sm sm:text-base text-muted-foreground mb-4 text-pretty">{event.description}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <p className="text-xs sm:text-sm text-muted-foreground">{t("event.shareLink")}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyLink} className="flex-1 sm:flex-initial sm:w-auto bg-transparent text-xs sm:text-sm px-3 py-1.5 h-8">
                {copied ? (
                  <>
                    <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    {t("event.linkCopied")}
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    {t("event.copyLink")}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQr((prev) => !prev)}
                className="flex-1 sm:flex-initial sm:w-auto bg-transparent text-xs sm:text-sm px-3 py-1.5 h-8"
              >
                {showQr ? t("event.hideQr") : t("event.showQr")}
              </Button>
            </div>
            {/* 純 Realtime 模式：不顯示推播啟用/狀態 UI */}
          </div>
          {/* 移除最新通知卡片（推播），保留下方活動動態（Realtime） */}
          {activityFeed.length > 0 && (
            <Card className="mt-4 p-4 border bg-background">
              <h3 className="text-sm font-semibold mb-2">活動動態（即時）</h3>
              <ul className="space-y-1 max-h-56 overflow-auto text-xs">
                {activityFeed.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{a.time.toLocaleTimeString()}</span>
                    <span className="flex-1 truncate">{a.text}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {showQr && (
            <div className="mt-4 p-4 border rounded-lg inline-block bg-muted/40">
              <p className="text-xs mb-2 font-medium text-muted-foreground">{t("event.qrTitle")}</p>
              <div className="bg-white p-2 rounded">
                <QRCode value={typeof window !== 'undefined' ? window.location.href : ''} size={128} />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-2">{t("event.markAvailability")}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3">{t("event.clickDrag")}</p>


              <AvailabilityCalendar
                startDate={event.start_date}
                endDate={event.end_date}
                selectedDates={event.selected_dates}
                startHour={event.start_hour}
                endHour={event.end_hour}
                selectedSlots={selectedSlots}
                onSlotsChange={setSelectedSlots}
                heatmapData={participants.length > 0 ? getHeatmapData() : undefined}
                maxParticipants={participants.length}
                onSlotFocus={(date, hour) => setFocusSlot({ date, hour })}
              />
            </Card>

            {focusSlot && (
              <Card className="p-4 sm:p-6">
                <h3 className="text-sm sm:text-base font-semibold mb-2">
                  {t("event.slotInfo")} {`${focusSlot.date.getMonth() + 1}/${focusSlot.date.getDate()} ${focusSlot.hour.toString().padStart(2, '0')}:00`}
                </h3>
                {(() => {
                  const key = `${focusSlot.date.toISOString().split('T')[0]}-${focusSlot.hour}`
                  const available = participants.filter((p: Participant) => p.availability.some((s: TimeSlot) => `${s.date.toISOString().split('T')[0]}-${s.hour}` === key))
                  const unavailable = participants.filter((p: Participant) => !available.includes(p))
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-medium mb-1 text-green-600">{t("event.available")}</div>
                        <ul className="list-disc pl-5">
                          {available.length === 0 && <li className="text-muted-foreground">{t("event.none")}</li>}
                          {available.map((p: Participant) => (
                            <li key={p.id}>{p.name}{p.locked ? ' 🔒' : ''}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-medium mb-1 text-red-600">{t("event.unavailable")}</div>
                        <ul className="list-disc pl-5">
                          {unavailable.length === 0 && <li className="text-muted-foreground">{t("event.none")}</li>}
                          {unavailable.map((p: Participant) => (
                            <li key={p.id}>{p.name}{p.locked ? ' 🔒' : ''}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )
                })()}
              </Card>
            )}

            <Card className="p-4 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("event.yourName")}</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("event.yourNamePlaceholder")}
                      required
                      className="text-base"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        id="lockName"
                        type="checkbox"
                        checked={lockName}
                        onChange={(e) => setLockName(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="lockName" className="text-xs text-muted-foreground cursor-pointer">{t("event.lockName")}</Label>
                    </div>
                    {lockName && (
                      <div className="mt-2">
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={t("event.enterPassword")}
                          className="text-sm"
                          required={lockName}
                        />
                        <p className="text-xs text-muted-foreground mt-1">{t("event.passwordPrompt")}</p>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full text-base py-6"
                  disabled={loading || !name.trim() || selectedSlots.length === 0}
                >
                  {loading ? t("event.submitting") : t("event.submit")}
                </Button>
              </form>
            </Card>
          </div>

          <div className="space-y-6">
            <BestTimesList participants={participants} startHour={event.start_hour} endHour={event.end_hour} />
            <ParticipantList participants={participants} />
          </div>
        </div>
      </div>
    </div>
  )
}
 
