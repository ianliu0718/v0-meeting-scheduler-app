import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWebPush } from '@/lib/push'
import { configureWebPush } from '@/lib/config/vapid'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { eventId, title, message, tenantId } = body as {
      eventId: string
      title?: string
      message?: string
      tenantId?: string
    }
    if (!eventId) {
      return NextResponse.json({ ok: false, error: 'MISSING_EVENT_ID' }, { status: 400 })
    }
    const supabase = createAdminClient()

  // 確保自動配置 VAPID（若環境未手動提供）
  const vapid = configureWebPush()
  console.log('[push/notify] VAPID ready', vapid.publicKey.slice(0, 12) + '...')

  let query = supabase.from('push_subscriptions').select('endpoint,p256dh,auth')
      .eq('event_id', eventId)
    if (tenantId) query = query.eq('tenant_id', tenantId)

    const { data: subs, error } = await query
    if (error) {
      console.error('[push/notify] query error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    if (!subs || subs.length === 0) {
      return NextResponse.json({ ok: true, delivered: 0 })
    }

  const appName = process.env.PUSH_APP_NAME || 'ScheduleTime'
    const payload = {
      title: title || `${appName} 更新通知`,
      body: message || '有新的參與者加入或資料更新',
      icon: '/icon.png',
      data: { url: `/event/${eventId}` },
    }

    let success = 0
    const failed: Array<{ endpoint: string; error: string; statusCode?: number }> = []
    const cleaned: string[] = []
    for (const s of subs as any[]) {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      }
      try {
        await sendWebPush(subscription, payload)
        success++
      } catch (e) {
        const err: any = e
        const statusCode = err?.statusCode
        const msg = err?.message || 'unknown'
        console.warn('[push/notify] send failure:', statusCode, msg)
        failed.push({ endpoint: s.endpoint, error: msg, statusCode })
        // 自動清理已失效的訂閱（404/410 Gone）
        if (statusCode === 404 || statusCode === 410) {
          try {
            const del = await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', s.endpoint)
            if (del.error) {
              console.warn('[push/notify] cleanup delete error:', del.error)
            } else {
              cleaned.push(s.endpoint)
            }
          } catch (ce) {
            console.warn('[push/notify] cleanup exception:', ce)
          }
        }
      }
    }

    return NextResponse.json({ ok: true, delivered: success, total: subs.length, failed, cleaned: cleaned.length })
  } catch (e: any) {
    console.error('[push/notify] API error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
