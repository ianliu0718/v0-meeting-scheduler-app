import { NextResponse } from 'next/server'
import { getVapidKeys } from '@/lib/config/vapid'

export async function GET() {
  try {
    const { publicKey } = getVapidKeys(true)
    return NextResponse.json({ ok: true, publicKey })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
