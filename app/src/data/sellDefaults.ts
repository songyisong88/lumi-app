import type { ListingDraft, SellType } from './listingSpec'

/** Default price options per sell type (the seller edits prices / switches them on). */
type Opt = ListingDraft['options'][number]
const o = (id: string, label: string, sub: string, price: number, on = true, suffix?: string): Opt => ({ id, label, sub, price, on, suffix })
export const PRICE_OPTS: Record<SellType, Opt[]> = {
  img: [o('img', 'ภาพอย่างเดียว', 'ไฟล์ภาพความละเอียดเต็ม', 149), o('both', 'ภาพ + พรอมต์', 'ได้พรอมต์และค่าตั้งด้วย', 249), o('set', 'ทั้งชุด', 'ทุกภาพในชุด + พรอมต์', 449, false)],
  tpl: [o('basic', 'ชุดเริ่มต้น', 'แบบหลักในชุด', 199), o('full', 'ชุดเต็ม', 'ทุกแบบ + ไฟล์ซอร์ส', 349)],
  media: [o('std', 'ใช้ส่วนตัว / โซเชียล', 'คลิปส่วนตัวและเพจ', 290), o('com', 'เชิงพาณิชย์', 'โฆษณา ลูกค้า ยิงแอด', 890)],
  sw: [o('one', '1 เครื่อง', 'คีย์ใช้งาน 1 เครื่อง', 490), o('three', '3 เครื่อง', 'คีย์ใช้งาน 3 เครื่อง', 990, false)],
  game: [o('std', 'เกมเต็ม', 'ดาวน์โหลด + อัปเดต', 159)],
  bot: [o('m', 'รายเดือน', 'ยกเลิกได้ทุกเมื่อ', 299, true, '/เดือน'), o('y', 'รายปี', 'ประหยัด 2 เดือน', 2990, false, '/ปี')],
  skill: [o('std', 'ใช้เอง', '1 ผู้ใช้', 390), o('team', 'ทีม', 'ใช้ได้ 5 คน', 1290, false)],
  data: [o('std', 'ใช้ภายใน', 'วิเคราะห์ เทรนโมเดลในทีม', 390), o('com', 'เชิงพาณิชย์', 'ใช้ในสินค้าที่ขาย', 1290, false)],
  course: [o('full', 'คอร์สเต็ม', 'ดูได้ตลอดชีพ', 590)],
  font: [o('per', 'ใช้ส่วนตัว', 'งานส่วนตัว ไม่ขาย', 190), o('com', 'เชิงพาณิชย์', 'โลโก้ โฆษณา สินค้า', 590)],
  hire: [o('basic', 'เบสิก', '1 แบบ · แก้ 1 ครั้ง', 1500), o('std', 'มาตรฐาน', '2 แบบ · แก้ 3 ครั้ง', 2900), o('pro', 'โปร', '3 แบบ + ไฟล์ซอร์ส', 4900, false)],
}
