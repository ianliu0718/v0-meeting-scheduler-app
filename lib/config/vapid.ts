import fs from 'fs'
import path from 'path'
import webPush from 'web-push'

type VapidKeys = { publicKey: string; privateKey: string }

const FILE_PATH = path.resolve(process.cwd(), '.vapid.json')

function readFromEnv(): VapidKeys | null {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
  const prv = process.env.VAPID_PRIVATE_KEY
  if (pub && prv) return { publicKey: pub, privateKey: prv }
  return null
}

function readFromFile(): VapidKeys | null {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed.publicKey && parsed.privateKey) return parsed as VapidKeys
    }
  } catch (e) {
    console.warn('[vapid] read file failed:', (e as any).message)
  }
  return null
}

function writeToFile(keys: VapidKeys) {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(keys, null, 2), 'utf-8')
  } catch (e) {
    console.warn('[vapid] write file failed (non-fatal):', (e as any).message)
  }
}

export function getVapidKeys(autoGenerate = true): VapidKeys {
  // 1) env first
  const envKeys = readFromEnv()
  if (envKeys) return envKeys
  // 2) file
  const fileKeys = readFromFile()
  if (fileKeys) return fileKeys
  // 3) generate
  if (!autoGenerate) throw new Error('VAPID keys missing')
  const gen = webPush.generateVAPIDKeys()
  const keys: VapidKeys = { publicKey: gen.publicKey, privateKey: gen.privateKey }
  writeToFile(keys)
  return keys
}

export function configureWebPush() {
  const { publicKey, privateKey } = getVapidKeys(true)
  const subject = 'mailto:admin@localhost'
  webPush.setVapidDetails(subject, publicKey, privateKey)
  return { publicKey, privateKey }
}
