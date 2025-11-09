import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWebPush } from '@/lib/push'
import { configureWebPush } from '@/lib/config/vapid'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { eventId, endpoint, title, message, tenantId } = body as {
      eventId: string
      endpoint: string
      title?: string
      message?: string
      tenantId?: string
    }
    if (!eventId || !endpoint) {
      return NextResponse.json({ ok: false, error: 'MISSING_EVENT_ID_OR_ENDPOINT' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const vapid = configureWebPush()
    console.log('[push/notify-one] VAPID ready', vapid.publicKey.slice(0, 12) + '...')

    let query = supabase
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth')
      .eq('event_id', eventId)
      .eq('endpoint', endpoint)
    if (tenantId) query = query.eq('tenant_id', tenantId)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ ok: false, error: 'ENDPOINT_NOT_FOUND' }, { status: 404 })
    }

  const appName = process.env.PUSH_APP_NAME || 'ScheduleTime'
    const payload = {
      title: title || `${appName} 單裝置測試` ,
      body: message || '這是一則單裝置推播測試',
      icon: '/icon.png',
      data: { url: `/event/${eventId}` },
    }

    const s = data[0]
    const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }
    try {
      await sendWebPush(subscription, payload)
      return NextResponse.json({ ok: true, delivered: 1, total: 1, failed: [] })
    } catch (e: any) {
      const statusCode = e?.statusCode
      const msg = e?.message || 'unknown'
      // 不在這個 API 自動清理，交由批次 notify 負責
      return NextResponse.json({ ok: true, delivered: 0, total: 1, failed: [{ endpoint, error: msg, statusCode }] })
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
