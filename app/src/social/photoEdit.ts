// Simple Instagram-like filters and crop presets, baked into a JPEG on the device.
export type Aspect = 'orig' | '1:1' | '4:5' | '16:9'
export const FILTERS = [
  { k: 'none', l: 'ปกติ', css: 'none' },
  { k: 'warm', l: 'อบอุ่น', css: 'sepia(.25) saturate(1.25) brightness(1.04)' },
  { k: 'cool', l: 'เย็น', css: 'hue-rotate(-12deg) saturate(1.1) brightness(1.03)' },
  { k: 'vivid', l: 'สด', css: 'saturate(1.5) contrast(1.08)' },
  { k: 'fade', l: 'จาง', css: 'contrast(.88) brightness(1.08) saturate(.85)' },
  { k: 'mono', l: 'ขาวดำ', css: 'grayscale(1) contrast(1.1)' },
]
const RATIO: Record<Aspect, number | null> = { orig: null, '1:1': 1, '4:5': 4 / 5, '16:9': 16 / 9 }
export async function bakePhoto(src: string, filter: string, aspect: Aspect): Promise<string> {
  const img = new Image(); img.src = src
  await img.decode()
  const r = RATIO[aspect]
  let sw = img.naturalWidth, sh = img.naturalHeight
  if (r) { if (sw / sh > r) sw = Math.round(sh * r); else sh = Math.round(sw / r) }
  const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2
  const k = Math.min(1, 1440 / Math.max(sw, sh))
  const cv = document.createElement('canvas'); cv.width = Math.round(sw * k); cv.height = Math.round(sh * k)
  const ctx = cv.getContext('2d')!
  ctx.filter = FILTERS.find((f) => f.k === filter)?.css ?? 'none'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height)
  return cv.toDataURL('image/jpeg', 0.9)
}
