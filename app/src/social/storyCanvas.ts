import type { StoryOverlay } from '../data/appTypes'

export const FILTERS: [string, string][] = [
  ['ปกติ', ''], ['อบอุ่น', 'sepia(.25) saturate(1.3) brightness(1.04)'], ['เย็น', 'hue-rotate(-12deg) saturate(1.1) brightness(1.03)'],
  ['ขาวดำ', 'grayscale(1)'], ['วินเทจ', 'sepia(.5) contrast(.9) brightness(1.05)'], ['สดใส', 'saturate(1.6) contrast(1.08)'],
]
export const TEXT_BG = 'linear-gradient(135deg,#7B2FF2,#F0508A)'
export interface Stroke { c: string; w: number; pts: [number, number][] }
/** CSS class suffix and base font size (CSS px at a 390-px wide frame) of each layer kind. */
export const ovlKind = (o: StoryOverlay) => (o.t === 'text' ? `t${o.st ?? 0}` : o.t === 'sticker' ? 'stk' : o.t === 'mention' ? 'men' : 'emj')
const BASE = { text: 30, sticker: 15, mention: 15, emoji: 64 }

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
/** Draws one layer like the CSS in Social.module.css (.ovl.*). k = canvas px per CSS px. */
export function drawOverlay(ctx: CanvasRenderingContext2D, o: StoryOverlay, W: number, H: number, k: number) {
  const fs = BASE[o.t] * k
  const weight = o.t === 'text' && (o.st ?? 0) > 0 ? 800 : 700
  ctx.save()
  ctx.translate(o.x * W, o.y * H); ctx.rotate((o.r * Math.PI) / 180); ctx.scale(o.s, o.s)
  ctx.font = `${weight} ${fs}px "IBM Plex Sans Thai","Noto Sans Thai",system-ui,sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const lines = o.text.split('\n'), lh = fs * (o.t === 'emoji' ? 1 : 1.3)
  const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)), th = lh * lines.length
  const kind = ovlKind(o)
  const pad: [number, number] = kind === 't0' || kind === 't2' ? [14, 4] : kind === 'stk' ? [12, 6] : kind === 'men' ? [12, 5] : [0, 0]
  const bw = tw + pad[0] * 2 * k, bh = th + pad[1] * 2 * k
  let fill = o.color ?? '#fff'
  if (kind === 't0' || kind === 'men') { ctx.fillStyle = kind === 'men' ? 'rgba(255,255,255,.92)' : '#fff'; rr(ctx, -bw / 2, -bh / 2, bw, bh, (kind === 'men' ? 10 : 10) * k); ctx.fill(); fill = kind === 'men' ? '#C13AE0' : o.color ?? '#6C2BD9' }
  if (kind === 't2' || kind === 'stk') {
    const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0); g.addColorStop(0, '#7B2FF2'); g.addColorStop(1, '#F0508A')
    ctx.fillStyle = g; rr(ctx, -bw / 2, -bh / 2, bw, bh, (kind === 'stk' ? 12 : 10) * k); ctx.fill(); fill = '#fff'
  }
  if (kind === 't1') { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 8 * k; ctx.shadowOffsetY = 2 * k }
  ctx.fillStyle = fill
  lines.forEach((l, i) => ctx.fillText(l, 0, -th / 2 + lh * (i + 0.5)))
  ctx.restore()
}
function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('โหลดรูปไม่ได้')); i.src = src })
}
/** Picture slide → one JPEG with filter, drawing and layers burned in. Same aspect as the editor frame (width 1080). */
export async function bakeImage(x: { src?: string; bg?: string; filter: string; strokes: Stroke[]; overlays: StoryOverlay[]; frameW: number; frameH: number }) {
  const W = 1080, H = Math.min(2400, Math.round((1080 * x.frameH) / x.frameW)), k = W / x.frameW
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  if (x.src) {
    const img = await loadImg(x.src)
    const sc = Math.max(W / img.width, H / img.height), dw = img.width * sc, dh = img.height * sc
    ctx.filter = x.filter || 'none'
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
    ctx.filter = 'none'
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#7B2FF2'); g.addColorStop(1, '#F0508A')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  }
  drawStrokes(ctx, x.strokes, W, H, k)
  for (const o of x.overlays) drawOverlay(ctx, o, W, H, k)
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('สร้างรูปไม่ได้'))), 'image/jpeg', 0.88))
}
