import type { ListingDraft, SellType } from './listingSpec'

/** Default price options per sell type (the seller edits prices / switches them on). */
type Opt = ListingDraft['options'][number]
const o = (id: string, label: string, sub: string, price: number, on = true, suffix?: string): Opt => ({ id, label, sub, price, on, suffix })
export const PRICE_OPTS: Record<SellType, Opt[]> = {
  img: [o('img', 'ภาพอย่างเดียว', 'ไฟล์ภาพความละเอียดเต็ม', 149), o('both', 'ภาพ + พรอมต์', 'ได้พรอมต์และค่าตั้งด้วย', 249), o('set', 'ทั้งชุด', 'ทุกภาพในชุด + พรอมต์', 449, false), o('prompt', 'พรอมต์อย่างเดียว', 'สูตรพรอมต์ + ค่าตั้ง ไม่รวมไฟล์ภาพ', 79, false)],
  tpl: [o('basic', 'ชุดเริ่มต้น', 'แบบหลักในชุด', 199), o('full', 'ชุดเต็ม', 'ทุกแบบ + ไฟล์ซอร์ส', 349)],
  media: [o('std', 'ใช้ส่วนตัว / โซเชียล', 'คลิปส่วนตัวและเพจ', 290), o('com', 'เชิงพาณิชย์', 'โฆษณา ลูกค้า ยิงแอด', 890)],
  sw: [o('one', '1 เครื่อง', 'คีย์ใช้งาน 1 เครื่อง', 490), o('three', '3 เครื่อง', 'คีย์ใช้งาน 3 เครื่อง', 990, false)],
  game: [o('std', 'เกมเต็ม', 'ดาวน์โหลด + อัปเดต', 159)],
  // One-time by default (owner 2026-11-03): no monthly plans until subscriptions open.
  bot: [o('one', 'ซื้อครั้งเดียว', 'ใช้ได้ไม่จำกัดเวลา · ไม่มีค่ารายเดือน', 1490)],
  skill: [o('std', 'ใช้เอง', '1 ผู้ใช้', 390), o('team', 'ทีม', 'ใช้ได้ 5 คน', 1290, false)],
  data: [o('std', 'ใช้ภายใน', 'วิเคราะห์ เทรนโมเดลในทีม', 390), o('com', 'เชิงพาณิชย์', 'ใช้ในสินค้าที่ขาย', 1290, false)],
  course: [o('full', 'คอร์สเต็ม', 'ทุกตอน + ไฟล์ประกอบ', 590)],
  font: [o('per', 'ใช้ส่วนตัว', 'งานส่วนตัว ไม่ขาย', 190), o('com', 'เชิงพาณิชย์', 'โฆษณา สินค้า งานธุรกิจ', 590)],
  hire: [o('basic', 'เริ่มต้น', '1 แบบ · แก้ 1 ครั้ง', 1500), o('std', 'มาตรฐาน', '2 แบบ · แก้ 3 ครั้ง', 2900), o('pro', 'พรีเมียม', '3 แบบ + ไฟล์ซอร์ส', 4900, false)],
}
