// Email 通知已停用，保留空路由作為備援佔位
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ ok: false, error: 'EMAIL_DISABLED' }, { status: 410 })
}
