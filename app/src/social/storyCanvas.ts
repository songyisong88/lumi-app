import type { StoryOverlay } from '../data/appTypes'

export const FILTERS: [string, string][] = [
  ['ปกติ', ''], ['อบอุ่น', 'sepia(.25) saturate(1.3) brightness(1.04)'], ['เย็น', 'hue-rotate(-12deg) saturate(1.1) brightness(1.03)'],
  ['ขาวดำ', 'grayscale(1)'], ['วินเทจ', 'sepia(.5) contrast(.9) brightness(1.05)'], ['สดใส', 'saturate(1.6) contrast(1.08)'],
]
export const TEXT_BG = 'linear-gradient(135deg,#7B2FF2,#F0508A)'
/** Background presets for text-only stories (tap the colour dot to change). */
export const BG_PRESETS: string[][] = [['#7B2FF2', '#F0508A'], ['#0EA5E9', '#22C55E'], ['#F59E0B', '#EF4444'], ['#16132B', '#4C1D95'], ['#F472B6', '#FDE68A'], ['#111111', '#111111']]
export interface Stroke { c: string; w: number; pts: [number, number][] }
/** Photo / clip position: x, y = offset of its centre as a share of the frame, s = zoom (1 = fitted), r = degrees. */
export interface MT { x: number; y: number; s: number; r: number }
export const MT0: MT = { x: 0, y: 0, s: 1, r: 0 }
/** CSS class suffix of each layer kind. */
export const ovlKind = (o: StoryOverlay) => (o.t === 'text' ? `t${o.st ?? 0}` : o.t === 'sticker' ? 'stk' : o.t === 'mention' ? 'men' : 'emj')
const light = (c: string) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c); if (!m) return true; const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16)); return r * 0.299 + g * 0.587 + b * 0.114 > 170 }
/** Colours of a layer (same for the screen and the saved picture). Box text = Instagram: the box takes the colour, text contrasts. */
export function ovlColors(o: StoryOverlay): { bg?: string; fg: string } {
  const k = ovlKind(o), c = o.color ?? '#ffffff'
  if (k === 't0') return { bg: c, fg: light(c) ? '#16132B' : '#ffffff' }
  if (k === 't1') return { fg: c }
  if (k === 'men') return { bg: 'rgba(255,255,255,.92)', fg: '#C13AE0' }
  return { fg: '#ffffff' }
}
const BASE = { text: 30, sticker: 15, mention: 15, emoji: 64, media: 15 }

/** Fitted size of a w×h picture in a W×H frame: fill when the shapes are close (like Instagram), else fit inside. */
export function fitBox(nw: number, nh: number, W: number, H: number) {
  const a = nw / nh, b = W / H
  const f = Math.abs(a - b) / b < 0.12 ? Math.max(W / nw, H / nh) : Math.min(W / nw, H / nh)
  return { w: nw * f, h: nh * f }
}
/** CSS for the photo / clip layer. */
export const mediaCss = (mt: MT, box: { w: number; h: number }, W: number, H: number): React.CSSProperties => ({
  position: 'absolute', inset: 'auto', left: '50%', top: '50%', width: box.w, height: box.h, maxWidth: 'none', maxHeight: 'none', objectFit: 'cover',
  transform: `translate(-50%,-50%) translate(${mt.x * W}px,${mt.y * H}px) rotate(${mt.r}deg) scale(${mt.s})`, transformOrigin: 'center',
})
export const mediaTransform = (mt: MT, W: number, H: number) => `translate(-50%,-50%) translate(${mt.x * W}px,${mt.y * H}px) rotate(${mt.r}deg) scale(${mt.s})`
export const bgCss = (c?: string[], deg = 180) => (c && c.length >= 2 ? `linear-gradient(${deg}deg,${c[0]},${c[1]})` : '#111')

/** Two colours from the top and bottom of a picture (for the background behind it, like Instagram). */
export function sampleColors(el: HTMLImageElement | HTMLVideoElement): string[] {
  try {
    const c = document.createElement('canvas'); c.width = 24; c.height = 24
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(el, 0, 0, 24, 24)
    const avg = (y0: number, y1: number) => {
      const d = ctx.getImageData(0, y0, 24, y1 - y0).data; let r = 0, g = 0, b = 0, n = 0
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ }
      const k = 0.82 // a little darker so text stays readable
      return `rgb(${Math.round((r / n) * k)},${Math.round((g / n) * k)},${Math.round((b / n) * k)})`
    }
    return [avg(0, 6), avg(18, 24)]
  } catch { return ['#222222', '#111111'] }
}
/** Paints a CSS linear-gradient(deg, c0, c1) over the whole canvas. */
function fillGradient(ctx: CanvasRenderingContext2D, c: string[], deg: number, W: number, H: number) {
  const a = (deg * Math.PI) / 180, dx = Math.sin(a), dy = -Math.cos(a)
  const L = Math.abs(W * dx) + Math.abs(H * dy)
  const g = ctx.createLinearGradient(W / 2 - (dx * L) / 2, H / 2 - (dy * L) / 2, W / 2 + (dx * L) / 2, H / 2 + (dy * L) / 2)
  g.addColorStop(0, c[0]); g.addColorStop(1, c[1] ?? c[0])
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
}

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], W: number, H: number, k: number) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  for (const st of strokes) {
    if (!st.pts.length) continue
    ctx.strokeStyle = st.c; ctx.lineWidth = st.w * k
    ctx.beginPath(); ctx.moveTo(st.pts[0][0] * W, st.pts[0][1] * H)
    for (const [x, y] of st.pts.slice(1)) ctx.lineTo(x * W, y * H)
    if (st.pts.length === 1) ctx.lineTo(st.pts[0][0] * W + 0.1, st.pts[0][1] * H)
    ctx.stroke()
  }
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h)
}
/** Size of a layer exactly as the browser lays it out (before its scale/rotate). */
export function measure(el: HTMLElement): NonNullable<StoryOverlay['m']> {
  const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 16
  const lh = cs.lineHeight === 'normal' ? fs * 1.2 : parseFloat(cs.lineHeight)
  return { w: el.offsetWidth, h: el.offsetHeight, fs, fw: parseInt(cs.fontWeight) || 700, lh, px: parseFloat(cs.paddingLeft) || 0, py: parseFloat(cs.paddingTop) || 0, br: parseFloat(cs.borderTopLeftRadius) || 0 }
}
/** Draws one layer like the CSS in Social.module.css (.ovl.*). k = canvas px per CSS px. Uses the measured box when there is one. */
export function drawOverlay(ctx: CanvasRenderingContext2D, o: StoryOverlay, W: number, H: number, k: number) {
  if (o.t === 'media') return
  const kind = ovlKind(o)
  const m = o.m
  const fs = (m?.fs ?? BASE[o.t]) * k
  const weight = m?.fw ?? (o.t === 'text' && (o.st ?? 0) > 0 ? 800 : 700)
  ctx.save()
  ctx.translate(o.x * W, o.y * H); ctx.rotate((o.r * Math.PI) / 180); ctx.scale(o.s, o.s)
  ctx.font = `${weight} ${fs}px "IBM Plex Sans Thai","Noto Sans Thai",system-ui,sans-serif`
  ctx.textBaseline = 'middle'
  const lines = o.text.split('\n'), lh = m ? m.lh * k : fs * (o.t === 'emoji' ? 1 : 1.3)
  const th = lh * lines.length
  const pad: [number, number] = m ? [m.px, m.py] : kind === 't0' || kind === 't2' ? [14, 4] : kind === 'stk' ? [12, 6] : kind === 'men' ? [12, 5] : [0, 0]
  const tw = Math.max(...lines.map((l) => ctx.measureText(l).width))
  const bw = m ? m.w * k : tw + pad[0] * 2 * k, bh = m ? m.h * k : th + pad[1] * 2 * k
  const br = (m?.br ?? (kind === 'stk' ? 12 : 10)) * k
  const cl = ovlColors(o)
  let fill = cl.fg
  if (cl.bg) { ctx.fillStyle = cl.bg; rr(ctx, -bw / 2, -bh / 2, bw, bh, br); ctx.fill() }
  if (kind === 't2' || kind === 'stk') {
    const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0); g.addColorStop(0, '#7B2FF2'); g.addColorStop(1, '#F0508A')
    ctx.fillStyle = g; rr(ctx, -bw / 2, -bh / 2, bw, bh, br); ctx.fill(); fill = '#fff'
  }
  if (kind === 't1') { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 8 * k; ctx.shadowOffsetY = 2 * k }
  ctx.fillStyle = fill
  const al = o.al ?? 'c'
  ctx.textAlign = al === 'l' ? 'left' : al === 'r' ? 'right' : 'center'
  const x = al === 'l' ? -bw / 2 + pad[0] * k : al === 'r' ? bw / 2 - pad[0] * k : 0
  lines.forEach((l, i) => ctx.fillText(l, x, -th / 2 + lh * (i + 0.5)))
  ctx.restore()
}
function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('โหลดรูปไม่ได้')); i.src = src })
}
/** Picture slide → one JPEG with background, the moved/zoomed/rotated photo, filter, drawing and layers burned in.
 *  Same geometry as the editor (mediaCss / fitBox), so the story looks exactly like what was composed. */
export async function bakeImage(x: { src?: string; bg?: string[]; bgDeg?: number; mt?: MT; filter: string; strokes: Stroke[]; overlays: StoryOverlay[]; frameW: number; frameH: number }) {
  const W = 1080, H = Math.min(2400, Math.round((1080 * x.frameH) / x.frameW)), k = W / x.frameW
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  fillGradient(ctx, x.bg ?? ['#7B2FF2', '#F0508A'], x.bgDeg ?? (x.src ? 180 : 135), W, H)
  if (x.src) {
    const img = await loadImg(x.src)
    const mt = x.mt ?? MT0, box = fitBox(img.naturalWidth, img.naturalHeight, x.frameW, x.frameH)
    ctx.save()
    ctx.filter = x.filter || 'none'
    ctx.translate(W / 2 + mt.x * W, H / 2 + mt.y * H); ctx.rotate((mt.r * Math.PI) / 180); ctx.scale(mt.s, mt.s)
    ctx.drawImage(img, (-box.w * k) / 2, (-box.h * k) / 2, box.w * k, box.h * k)
    ctx.restore()
  }
  drawStrokes(ctx, x.strokes, W, H, k)
  for (const o of x.overlays) drawOverlay(ctx, o, W, H, k)
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('สร้างรูปไม่ได้'))), 'image/jpeg', 0.9))
}
