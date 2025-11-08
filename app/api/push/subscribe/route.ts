import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { configureWebPush } from '@/lib/config/vapid'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { eventId, subscription, participantId, tenantId } = body as {
      eventId: string
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
      participantId?: string
      tenantId?: string
    }
    if (!eventId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ ok: false, error: 'INVALID_INPUT' }, { status: 400 })
    }

  // 確保有 VAPID（金鑰不存在會自動產生並寫入 .vapid.json）
  const vapid = configureWebPush()
  console.log('[push/subscribe] using VAPID public key', vapid.publicKey.slice(0, 12) + '...')

  const supabase = createAdminClient()

    // 準備插入資料：若資料表含 tenant_id 欄位，會帶入；否則忽略。
    const row: Record<string, any> = {
      event_id: eventId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    }
    if (participantId) row.participant_id = participantId
    if (tenantId) row.tenant_id = tenantId

    // upsert 以 endpoint 為 unique 鍵
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(row, { onConflict: 'endpoint' })
      .select()
      .single()

    if (error) {
      console.error('[push/subscribe] upsert error:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    console.error('[push/subscribe] API error:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
