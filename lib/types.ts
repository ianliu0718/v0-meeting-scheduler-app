export interface TimeSlot {
  date: Date
  hour: number
}

export interface Participant {
  id: string
  name: string
  email?: string
  availability: TimeSlot[]
  created_at: Date
}

export interface Event {
  id: string
  title: string
  description?: string
  start_date: Date
  end_date: Date
  start_hour: number
  end_hour: number
  timezone: string
  duration: number
  created_at: Date
}

export interface Notification {
  id: string
  event_id: string
  participant_id?: string
  type: "new_participant" | "availability_update"
  message: string
  read: boolean
  created_at: Date
}

export type Language = "en" | "zh-TW" | "es" | "tl" | "id"
