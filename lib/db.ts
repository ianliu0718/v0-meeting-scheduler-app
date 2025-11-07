import { createClient } from "./supabase/client"
import type { Event, Participant } from "./types"

export async function createEvent(event: Omit<Event, "created_at">) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("events")
    .insert({
      id: event.id,
      title: event.title,
      description: event.description,
      start_date: event.start_date.toISOString(),
      end_date: event.end_date.toISOString(),
      start_hour: event.start_hour,
      end_hour: event.end_hour,
      timezone: event.timezone,
      duration: event.duration,
    })
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

  return {
    ...data,
    start_date: new Date(data.start_date),
    end_date: new Date(data.end_date),
    created_at: new Date(data.created_at),
  }
}

export async function createParticipant(eventId: string, participant: Omit<Participant, "id" | "created_at">) {
  const supabase = createClient()

  const participantId = Math.random().toString(36).substring(2, 15)

  const { data, error } = await supabase
    .from("participants")
    .insert({
      id: participantId,
      event_id: eventId,
      name: participant.name,
      email: participant.email,
      availability: JSON.stringify(
        participant.availability.map((slot) => ({
          date: slot.date.toISOString(),
          hour: slot.hour,
        })),
      ),
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

  return data.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    availability: (typeof p.availability === "string" ? JSON.parse(p.availability) : p.availability).map(
      (slot: any) => ({
        date: new Date(slot.date),
        hour: slot.hour,
      }),
    ),
    created_at: new Date(p.created_at),
  }))
}
