const M = 60_000, H = 60 * M, D = 24 * H
const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
/** “เมื่อสักครู่ / 5 นาที / 3 ชม. / เมื่อวาน / 12 พ.ย.” */
export function ago(at: number, now = Date.now()) {
  const d = now - at
  if (d < M) return 'เมื่อสักครู่'
  if (d < H) return `${Math.floor(d / M)} นาที`
  if (d < D) return `${Math.floor(d / H)} ชม.`
  if (d < 2 * D) return 'เมื่อวาน'
  if (d < 7 * D) return `${Math.floor(d / D)} วัน`
  const t = new Date(at)
  return `${t.getDate()} ${TH_MON[t.getMonth()]}`
}
export const clock = (at: number) => new Date(at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
export function dayLabel(at: number, now = Date.now()) {
  const a = new Date(at), n = new Date(now)
  const same = (x: Date, y: Date) => x.toDateString() === y.toDateString()
  if (same(a, n)) return 'วันนี้'
  const y = new Date(now - D)
  if (same(a, y)) return 'เมื่อวาน'
  return `${a.getDate()} ${TH_MON[a.getMonth()]} ${a.getFullYear() + 543}`
}
