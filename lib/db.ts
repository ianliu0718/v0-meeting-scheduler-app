import { createClient } from "./supabase/client"
import type { Event, Participant, TimeSlot } from "./types"

export async function createEvent(event: Omit<Event, "created_at">) {
  const supabase = createClient()

  const insertData: any = {
    id: event.id,
    title: event.title,
    description: event.description,
    start_date: event.start_date.toISOString(),
    end_date: event.end_date.toISOString(),
    start_hour: event.start_hour,
    end_hour: event.end_hour,
    timezone: event.timezone,
    duration: event.duration,
  }

  // 如果有不連續日期，儲存為 JSONB
  if (event.selected_dates && event.selected_dates.length > 0) {
    insertData.selected_dates = event.selected_dates.map(d => d.toISOString())
  }

  const { data, error } = await supabase
    .from("events")
    .insert(insertData)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getEvent(eventId: string): Promise<Event | null> {
  const supabase = createClient()

  const { data, error } = await supabase.from("events").select("*").eq("id", eventId).single()

  if (error) {
    console.error("[v0] Error fetching event:", error)
    return null
  }

  const event: Event = {
    ...data,
    start_date: new Date(data.start_date),
    end_date: new Date(data.end_date),
    created_at: new Date(data.created_at),
  }

  // 解析不連續日期（如果有的話）
  if (data.selected_dates && Array.isArray(data.selected_dates)) {
    event.selected_dates = data.selected_dates.map((d: string) => new Date(d))
  }

  return event
}

export async function createParticipant(eventId: string, participant: Omit<Participant, "id" | "created_at">) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("participants")
    .insert({
      event_id: eventId,
      name: participant.name,
      email: participant.email,
      availability: participant.availability.map((slot) => ({
        date: slot.date.toISOString(),
        hour: slot.hour,
      })),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getParticipants(eventId: string): Promise<Participant[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("participants")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching participants:", error)
    return []
  }

  return data.map((p: any) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    locked: p.locked ?? false,
    availability: (Array.isArray(p.availability) ? p.availability : (typeof p.availability === 'string' ? JSON.parse(p.availability) : [])).map(
      (slot: any) => ({
        date: new Date(slot.date),
        hour: slot.hour,
      }),
    ),
    created_at: new Date(p.created_at),
  }))
}

export async function upsertParticipant(
  eventId: string,
  participant: { name: string; email?: string; availability: TimeSlot[]; lock?: boolean; password?: string },
): Promise<{ data: any; isNew: boolean }> {
  const supabase = createClient()
  const { data: existing, error: findErr } = await supabase
    .from('participants')
    .select('id, locked, auth_token')
    .eq('event_id', eventId)
    .eq('name', participant.name)
    .maybeSingle()
  if (findErr) throw findErr

  const availability = participant.availability.map((s) => ({ date: s.date.toISOString(), hour: s.hour }))

  if (!existing) {
    // 新參與者
    const body: any = {
      event_id: eventId,
      name: participant.name,
      email: participant.email,
      availability,
    }
    if (participant.lock && participant.password) {
      body.locked = true
      body.auth_token = participant.password  // 直接使用使用者輸入的密碼
    }
    const { data, error } = await supabase.from('participants').insert(body).select().single()
    if (!error) return { data, isNew: true }

    // 若因唯一鍵衝突（例如 (event_id, name) unique）導致 409，轉為更新流程
    const isConflict = (err: any) => err?.status === 409 || err?.code === '23505' || (typeof err?.message === 'string' && err.message.toLowerCase().includes('duplicate'))
    if (!isConflict(error)) throw error

    // 讀取既有紀錄並走既有更新邏輯
    const { data: exist2, error: findErr2 } = await supabase
      .from('participants')
      .select('id, locked, auth_token')
      .eq('event_id', eventId)
      .eq('name', participant.name)
      .maybeSingle()
    if (findErr2) throw findErr2
    if (!exist2) throw error

    if (exist2.locked && exist2.auth_token) {
      if (!participant.password || exist2.auth_token !== participant.password) {
        throw new Error('NAME_LOCKED')
      }
    }
    const updateBody: any = {
      email: participant.email,
      availability,
    }
    if (participant.lock && participant.password) {
      updateBody.locked = true
      updateBody.auth_token = participant.password
    }
    const { data: upd, error: updErr } = await supabase.from('participants').update(updateBody).eq('id', exist2.id).select().single()
    if (updErr) throw updErr
    return { data: upd, isNew: false }
  }

  // 已存在的參與者：檢查是否鎖定
  if (existing.locked && existing.auth_token) {
    // 驗證密碼
    if (!participant.password || existing.auth_token !== participant.password) {
      throw new Error('NAME_LOCKED')
    }
  }

  // 更新資料
  const updateBody: any = {
    email: participant.email,
    availability,
  }
  if (participant.lock && participant.password) {
    updateBody.locked = true
    updateBody.auth_token = participant.password
  }
  const { data, error } = await supabase.from('participants').update(updateBody).eq('id', existing.id).select().single()
  if (error) throw error
  return { data, isNew: false }
}
