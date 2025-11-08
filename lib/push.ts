import webPush from 'web-push'
import { configureWebPush } from './config/vapid'

let configured = false

export function ensureWebPushConfigured() {
  if (configured) return
  const { publicKey } = configureWebPush()
  console.log('[web-push] configured with public key', publicKey.slice(0, 16) + '...')
  configured = true
}

export async function sendWebPush(subscription: any, payload: any) {
  ensureWebPushConfigured()
  const body = JSON.stringify(payload)
  await webPush.sendNotification(subscription, body)
}
