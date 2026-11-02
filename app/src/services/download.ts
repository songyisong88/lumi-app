import type { Asset, Purchase } from '../data/appTypes'
import { assetsOf, downloadSample } from '../data/library'
import { fileLink } from './api'
import { toast } from './toast'

/** Real purchases: a fresh 10-minute link from get-download (checked + logged on the server). Sample purchases: a demo text file. */
export async function downloadAsset(x: Asset, b: Purchase) {
  if (!x.value.startsWith('cloud:')) { downloadSample(x, b); toast('ดาวน์โหลดไฟล์ตัวอย่างแล้ว'); return }
  try {
    const url = await fileLink(x.value)
    if (!url) return
    const el = document.createElement('a'); el.href = url; el.download = x.title; el.rel = 'noopener'
    document.body.appendChild(el); el.click(); el.remove()
    toast('เริ่มดาวน์โหลดแล้ว')
  } catch (e) { toast(e instanceof Error ? e.message : 'ดาวน์โหลดไม่สำเร็จ') }
}

/** The files of a purchase (keys, prompts and links are shown in the library, not downloaded). */
export const filesOfPurchase = (b: Purchase) => assetsOf(b).filter((a) => a.kind === 'file')
