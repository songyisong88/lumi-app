/**
 * Listing spec: what each product type MUST tell the buyer.
 * One source of truth for (1) the sell wizard fields, (2) the pre-publish auto-check,
 * and (3) the product page sections “สิ่งที่คุณจะได้รับ”, “วิธีใช้งาน”, “สิ่งที่ต้องมี”.
 * See /workspace/lumi-app-build/listing-spec.md for the human-readable version.
 */
import type { DetailKind, Product } from './types'

export type SellType = 'img' | 'tpl' | 'sw' | 'game' | 'bot' | 'course' | 'font' | 'hire' | 'media' | 'skill' | 'data'
export type SpecValue = string | string[] | boolean
export type Spec = Record<string, SpecValue | undefined>
export type Step = 'files' | 'details' | 'price' | 'license'
export type FieldKind = 'text' | 'textarea' | 'chips' | 'multi' | 'toggle' | 'list' | 'files'

export interface UploadedFile { name: string; size: string; scan: 'scan' | 'ok' | 'fail'; pct?: number }

export interface Field {
  id: string
  label: string
  kind: FieldKind
  step: Step
  options?: string[]
  placeholder?: string
  hint?: string
  /** true = always required; function = required depending on other answers. */
  required?: boolean | ((s: Spec) => boolean)
  /** Hide the field unless this returns true. */
  when?: (s: Spec) => boolean
  /** Minimum list length for list/multi/files when required (default 1). */
  min?: number
  /** Toggle that must be switched ON to publish (a confirmation, e.g. “no personal data”). */
  mustBeOn?: boolean
  /** Text must match (e.g. a real Canva / LINE link). */
  pattern?: RegExp
  patternNote?: string
}

export interface TypeSpec {
  key: SellType
  name: string
  sub: string
  icon: string
  color: string
  bg: string
  layout: DetailKind
  fields: Field[]
  defaults: Spec
}

// ---------- helpers
export const str = (v: SpecValue | undefined) => (typeof v === 'string' ? v.trim() : '')
export const arr = (v: SpecValue | undefined): string[] => (Array.isArray(v) ? v.filter((x) => String(x).trim()) : [])
export const on = (v: SpecValue | undefined) => v === true
export const filesOf = (v: SpecValue | undefined): UploadedFile[] =>
  arr(v).map((x) => { try { return JSON.parse(x) as UploadedFile } catch { return { name: x, size: '', scan: 'ok' as const } } })
const list = (xs: string[]) => xs.join(' · ')

/** Licence rows per type: what the buyer may do with the work. Shown as a ✓/– table on the product page. */
const VIS_ROWS = ['งานส่วนตัว การบ้าน', 'โพสต์ขายของ โฆษณา', 'สินค้าที่พิมพ์ขาย', 'โลโก้ ป้ายร้าน', 'ขายต่อหรือแจกต่อไฟล์']
const LIC_BY_TYPE: Record<SellType, string[]> = {
  img: VIS_ROWS,
  tpl: ['งานส่วนตัว การบ้าน', 'โพสต์ขายของ โฆษณา', 'ทำงานให้ลูกค้า', 'สินค้าที่พิมพ์ขาย', 'ขายต่อหรือแจกต่อไฟล์'],
  font: ['งานส่วนตัว การบ้าน', 'โพสต์ขายของ โฆษณา', 'ฝังบนเว็บ / แอป', 'สินค้าที่พิมพ์ขาย', 'โลโก้ ป้ายร้าน', 'ขายต่อหรือแจกต่อไฟล์'],
  media: ['ใช้ส่วนตัว', 'คลิปโซเชียลของตัวเอง', 'โฆษณา และงานให้ลูกค้า', 'ขายต่อหรือแจกต่อไฟล์'],
  sw: ['ใช้ส่วนตัว', 'ใช้ในธุรกิจตัวเอง', 'ติดตั้งให้ลูกค้า', 'ขายต่อหรือแจกต่อ'],
  game: ['เล่น / ใช้ส่วนตัว', 'ใช้ในงานหรือโปรเจกต์ที่ขาย', 'แก้ไขซอร์สโค้ด', 'ขายต่อหรือแจกต่อไฟล์'],
  bot: ['ใช้กับร้าน / บัญชีตัวเอง', 'ใช้หลายสาขา / หลายบัญชี', 'ติดตั้งให้ลูกค้า', 'ขายต่อหรือแจกต่อ'],
  course: ['เรียนคนเดียว', 'ใช้ในทีม / องค์กร', 'นำเนื้อหาไปสอนต่อ', 'แจกต่อไฟล์ประกอบ'],
  skill: ['ใช้ส่วนตัว', 'ใช้ในธุรกิจตัวเอง', 'แก้ไขและปรับใช้', 'ขายต่อหรือแจกต่อ'],
  data: ['วิเคราะห์ภายใน', 'ใช้ในแอป / บริการ', 'เทรนโมเดล AI', 'เผยแพร่ข้อมูลดิบต่อ'],
  hire: [],
}
export const licRows = (t: SellType | null) => (t && LIC_BY_TYPE[t].length ? LIC_BY_TYPE[t] : VIS_ROWS)
export const LIC_PRESET_NAMES = ['ใช้ส่วนตัว', 'ใช้ในธุรกิจ (ไม่ขายต่อไฟล์)', 'กำหนดเอง']
/** Rows a preset switches on. “โลโก้ ป้ายร้าน” is never on by default (non-exclusive work can't be a trademark). */
export function presetRows(t: SellType | null, preset: string): string[] {
  const rows = licRows(t)
  if (preset === 'ใช้ส่วนตัว') return rows.slice(0, 1)
  if (preset === 'ใช้ในธุรกิจ (ไม่ขายต่อไฟล์)') return t === 'course' ? rows.slice(0, 2) : rows.slice(0, -1).filter((r) => r !== 'โลโก้ ป้ายร้าน')
  return []
}
const licDefaults = (t: SellType, preset = 'ใช้ในธุรกิจ (ไม่ขายต่อไฟล์)'): Spec => ({ licPreset: preset, licAllowed: presetRows(t, preset) })

/** Every listing confirms it doesn't use other people's IP (legal review §3). */
const IP_OK: Field = { id: 'ipOk', label: 'ยืนยัน: ไม่มีตัวละคร โลโก้ แบรนด์ หรือหน้า/เสียงของคนจริงที่ไม่ได้รับอนุญาต และไม่มีเนื้อหาทางเพศ', kind: 'toggle', step: 'license', required: true, mustBeOn: true, hint: 'ถ้าถูกแจ้งละเมิด LUMI ซ่อนผลงานระหว่างตรวจสอบ' }
// Fields every type shares on the license step.
const LICENSE = (t: SellType): Field[] => [
  { id: 'licPreset', label: 'แบบสิทธิ์การใช้งาน', kind: 'chips', step: 'license', options: LIC_PRESET_NAMES, required: true },
  { id: 'licAllowed', label: 'ผู้ซื้อทำอะไรได้บ้าง', kind: 'multi', step: 'license', options: licRows(t), required: true, hint: t === 'img' ? 'ตารางนี้โชว์บนหน้าผลงาน · “โลโก้ ป้ายร้าน” ไม่แนะนำ เพราะงานขายหลายคนจดเครื่องหมายการค้าไม่ได้' : 'ตารางนี้โชว์บนหน้าผลงาน' },
  IP_OK,
]
/** Standard refund choices (B8). Every order can still be reported within 7 days under LUMI's own policy. */
export const REFUND_STD = ['คืนเงินได้ภายใน 7 วัน ถ้าไฟล์เปิดไม่ได้หรือไม่ตรงคำอธิบาย', 'คืนเงินได้ภายใน 7 วัน ไม่ต้องให้เหตุผล', 'ไม่รับคืนถ้าเปลี่ยนใจ (ไฟล์เสียหรือไม่ตรงคำอธิบายยังคืนได้)']
const REFUND_HIRE = ['คืนเต็มจำนวนถ้ายังไม่เริ่มงาน หรือส่งงานไม่ตรงบรีฟ', 'คืนเต็มจำนวนถ้าส่งงานช้าเกินกำหนด', 'คืนบางส่วนตามงานที่ทำไปแล้ว ถ้ายกเลิกกลางทาง']
const refundField = (options: string[]): Field => ({ id: 'refund', label: 'เงื่อนไขคืนเงิน', kind: 'chips', step: 'license', required: true, options, hint: 'เลือกแบบที่ตรงกับงาน · ทุกออเดอร์แจ้งปัญหาได้ภายใน 7 วันตามนโยบาย LUMI อยู่แล้ว' })
const REFUND = refundField(REFUND_STD)
const REFUND_SW = refundField(['คืนเงินเต็มจำนวนภายใน 7 วัน ถ้าติดตั้งหรือใช้งานไม่ได้', ...REFUND_STD])
const SUPPORT: Field = { id: 'support', label: 'ซัพพอร์ตและอัปเดต', kind: 'text', step: 'license', required: true, placeholder: 'เช่น อัปเดตฟรี 1 ปี · ตอบแชตภายใน 24 ชม.' }
const FILES = (label: string, hint: string, req: boolean | ((s: Spec) => boolean) = true): Field => ({ id: 'files', label, kind: 'files', step: 'files', hint, required: req })

export const SPECS: Record<SellType, TypeSpec> = {
  img: {
    key: 'img', name: 'ภาพ + พรอมต์', sub: 'ภาพ ชุดภาพ หรือพรอมต์', icon: 'image', color: '#6C2BD9', bg: '#F3ECFF', layout: 'img',
    fields: [
      FILES('ไฟล์ภาพที่ผู้ซื้อได้รับ', 'ไฟล์ต้นฉบับ ไม่มีลายน้ำ LUMI · ห้ามลบลายน้ำที่ข้อตกลงของเครื่องมือ AI บังคับไว้'),
      { id: 'count', label: 'จำนวนภาพในชุด', kind: 'text', step: 'files', required: true, placeholder: 'เช่น 1 ภาพ หรือ 8 ภาพ 8 มุม' },
      { id: 'resolution', label: 'ความละเอียด', kind: 'chips', step: 'files', options: ['4K (3840 px ขึ้นไป)', '2K (2048 px)', 'Full HD (1920 px)', 'A4 300 dpi'], required: true },
      { id: 'formats', label: 'นามสกุลไฟล์', kind: 'multi', step: 'files', options: ['PNG', 'JPG', 'WEBP', 'PSD', 'SVG'], required: true },
      { id: 'aspect', label: 'สัดส่วนภาพ', kind: 'chips', step: 'details', options: ['1:1', '3:4', '4:5', '9:16', '16:9'], required: true },
      { id: 'sellPrompt', label: 'ขายพรอมต์ด้วย', kind: 'toggle', step: 'price', hint: 'ผู้ซื้อเห็นพรอมต์ฉบับเต็มหลังจ่าย' },
      { id: 'prompt', label: 'พรอมต์ฉบับเต็ม', kind: 'textarea', step: 'price', when: (s) => on(s.sellPrompt), required: (s) => on(s.sellPrompt), placeholder: '/imagine prompt: …' },
      { id: 'model', label: 'โมเดลที่ใช้', kind: 'chips', step: 'price', options: ['Midjourney v7', 'DALL·E 3', 'Stable Diffusion XL', 'Flux', 'Adobe Firefly', 'อื่น ๆ'], when: (s) => on(s.sellPrompt), required: (s) => on(s.sellPrompt) },
      { id: 'settings', label: 'ค่าตั้งที่ใช้ (seed / stylize / ar)', kind: 'text', step: 'price', when: (s) => on(s.sellPrompt), required: (s) => on(s.sellPrompt), placeholder: 'เช่น --ar 3:4 --stylize 650 --seed 1234' },
      ...LICENSE('img'),
    ],
    defaults: { resolution: '4K (3840 px ขึ้นไป)', formats: ['PNG'], aspect: '3:4', count: '1 ภาพ', sellPrompt: true, ...licDefaults('img') },
  },
  tpl: {
    key: 'tpl', name: 'เทมเพลต', sub: 'Canva PSD สไลด์ โพสต์', icon: 'megaphone', color: '#2563EB', bg: '#EAF1FF', layout: 'tpl',
    fields: [
      { id: 'apps', label: 'ต้องเปิดด้วยแอปอะไร', kind: 'multi', step: 'files', options: ['Canva', 'Photoshop', 'Illustrator', 'Figma', 'PowerPoint', 'Google Slides', 'Keynote', 'Excel / Sheets', 'เว็บ (HTML)'], required: true },
      { id: 'appVersion', label: 'เวอร์ชันแอปที่ต้องใช้', kind: 'text', step: 'files', required: true, placeholder: 'เช่น Canva ฟรี · Photoshop 2023 ขึ้นไป' },
      { id: 'canvaLink', label: 'ลิงก์ Canva แบบ “ใช้เป็นเทมเพลต”', kind: 'text', step: 'files', when: (s) => arr(s.apps).includes('Canva'), required: (s) => arr(s.apps).includes('Canva'), placeholder: 'canva.com/design/…/remix', pattern: /canva\.com\/design\//i, patternNote: 'ต้องเป็นลิงก์ canva.com/design/…', hint: 'ส่งให้ผู้ซื้อหลังจ่ายเท่านั้น' },
      { id: 'noPro', label: 'ไม่มีองค์ประกอบ Canva Pro (ผู้ซื้อใช้ Canva ฟรีได้)', kind: 'toggle', step: 'files', when: (s) => arr(s.apps).includes('Canva'), hint: 'เปิดเฉพาะเมื่อตรวจแล้วว่าไม่มีรูป ฟอนต์ หรือกราฟิก Pro · หน้าผลงานจะขึ้นว่า “ใช้ Canva ฟรีได้”' },
      FILES('ไฟล์เทมเพลต', 'PSD AI FIG PPTX PDF ฯลฯ · ต้องอัปทุกนามสกุลที่บอกว่าผู้ซื้อได้รับ', (s) => arr(s.apps).some((a) => a !== 'Canva') || arr(s.formats).some((f) => f !== 'ลิงก์ Canva')),
      { id: 'formats', label: 'ไฟล์ที่ผู้ซื้อได้รับ', kind: 'multi', step: 'files', options: ['ลิงก์ Canva', 'PSD', 'AI', 'FIG', 'PPTX', 'KEY', 'XLSX', 'HTML', 'PDF'], required: true },
      { id: 'count', label: 'จำนวนแบบ / หน้า', kind: 'text', step: 'files', required: true, placeholder: 'เช่น 30 แบบ' },
      { id: 'size', label: 'ขนาดชิ้นงาน', kind: 'text', step: 'files', required: true, placeholder: 'เช่น 1080×1350 px (IG 4:5)' },
      { id: 'fonts', label: 'ฟอนต์ที่ใช้ + ลิงก์โหลดฟรี', kind: 'list', step: 'details', required: (s) => arr(s.apps).some((a) => ['Photoshop', 'Illustrator', 'Figma', 'PowerPoint', 'Keynote', 'เว็บ (HTML)'].includes(a)), placeholder: 'เช่น Prompt — fonts.google.com/specimen/Prompt', hint: 'ถ้าไม่ใส่ ผู้ซื้อเปิดแล้วฟอนต์เพี้ยน' },
      { id: 'editable', label: 'แก้อะไรได้บ้าง', kind: 'multi', step: 'details', options: ['ข้อความ', 'สี', 'รูปภาพ', 'โลโก้', 'ฟอนต์', 'ขนาด / เลย์เอาต์'], required: true },
      { id: 'howOpen', label: 'วิธีเปิดและแก้ไข (ทีละขั้น)', kind: 'list', step: 'details', required: true },
      ...LICENSE('tpl'),
    ],
    defaults: { apps: ['Canva'], appVersion: 'Canva เวอร์ชันล่าสุด', formats: ['ลิงก์ Canva', 'PDF'], editable: ['ข้อความ', 'สี', 'รูปภาพ', 'โลโก้'], howOpen: ['เปิดลิงก์ Canva ในคลังของที่ซื้อ', 'กด “ใช้เทมเพลต” ระบบจะคัดลอกเข้าบัญชีคุณ', 'แก้ข้อความ สี และรูป แล้วกดแชร์ › ดาวน์โหลด'], ...licDefaults('tpl') },
  },
  sw: {
    key: 'sw', name: 'โปรแกรม · แอป', sub: 'ไฟล์ติดตั้ง คีย์ใช้งาน', icon: 'code', color: '#4F46E5', bg: '#EEF2FF', layout: 'sw',
    fields: [
      { id: 'sub', label: 'เป็นแบบไหน', kind: 'chips', step: 'files', options: ['โปรแกรม', 'แอปมือถือ', 'เว็บแอป', 'เครื่องมือร้านค้า'], required: true, hint: 'ใช้จัดหมวดย่อยบนหน้าค้นหา: ซอฟต์แวร์และโปรแกรม · แอปมือถือ · เครื่องมือ SME' },
      { ...FILES('ไฟล์ติดตั้ง', '.exe .dmg .apk .zip · LUMI สแกนไวรัสเบื้องต้นทุกไฟล์ ไฟล์ไม่ผ่านลงขายไม่ได้'), when: (s) => str(s.sub) !== 'เว็บแอป' },
      { id: 'webLink', label: 'ลิงก์เข้าใช้งานเว็บแอป', kind: 'text', step: 'files', when: (s) => str(s.sub) === 'เว็บแอป', required: (s) => str(s.sub) === 'เว็บแอป', placeholder: 'https://app.ร้านคุณ.com', pattern: /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i, patternNote: 'ต้องเป็นลิงก์เว็บ เช่น https://app.example.com', hint: 'เว็บแอปไม่ต้องอัปไฟล์ติดตั้ง · ส่งลิงก์ให้ผู้ซื้อหลังจ่ายเท่านั้น' },
      { id: 'storeLink', label: 'ลิงก์ร้านค้าแอป (App Store / Google Play / Chrome Web Store / TestFlight)', kind: 'text', step: 'files', when: (s) => arr(s.platforms).some((x) => ['iOS', 'Android', 'Chrome'].includes(x)), required: (s) => arr(s.platforms).includes('iOS'), placeholder: 'เช่น testflight.apple.com/join/…', pattern: /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i, patternNote: 'ต้องเป็นลิงก์ เช่น apps.apple.com/… หรือ testflight.apple.com/join/…', hint: 'iOS ติดตั้งจากไฟล์ไม่ได้ ต้องมีลิงก์ App Store หรือ TestFlight' },
      { id: 'platforms', label: 'ใช้กับเครื่องอะไรได้', kind: 'multi', step: 'files', options: ['Windows', 'macOS', 'Linux', 'เว็บ', 'Android', 'iOS'], required: true },
      { id: 'minSpec', label: 'สเปกขั้นต่ำ', kind: 'text', step: 'files', required: true, placeholder: 'เช่น Windows 10 · RAM 4 GB · พื้นที่ 200 MB' },
      { id: 'version', label: 'เวอร์ชัน', kind: 'text', step: 'files', required: true, placeholder: 'เช่น v1.3' },
      { id: 'changelog', label: 'มีอะไรใหม่ (ประวัติอัปเดต)', kind: 'list', step: 'files', required: true, placeholder: 'เช่น v1.3 · พิมพ์ใบเสร็จผ่าน Bluetooth' },
      { id: 'deps', label: 'ต้องติดตั้งอะไรเพิ่ม', kind: 'text', step: 'details', required: true, placeholder: 'เช่น ไม่ต้อง · หรือ .NET 8 Runtime' },
      { id: 'install', label: 'วิธีติดตั้ง (ทีละขั้น)', kind: 'list', step: 'details', required: true },
      { id: 'trial', label: 'เปิดให้ทดลองใช้ก่อนซื้อ', kind: 'toggle', step: 'price' },
      { id: 'trialDays', label: 'ทดลองได้กี่วัน', kind: 'chips', step: 'price', options: ['7 วัน', '14 วัน', '30 วัน'], when: (s) => on(s.trial), required: (s) => on(s.trial) },
      { id: 'keyType', label: 'แบบคีย์ใช้งาน', kind: 'chips', step: 'license', options: ['คีย์ต่อเครื่อง', 'คีย์ต่อบัญชี', 'สมาชิกรายเดือน', 'ไม่ต้องใช้คีย์'], required: true },
      { id: 'activation', label: 'วิธีใส่คีย์ / เปิดใช้งาน', kind: 'list', step: 'license', when: (s) => str(s.keyType) !== 'ไม่ต้องใช้คีย์', required: (s) => str(s.keyType) !== 'ไม่ต้องใช้คีย์' },
      SUPPORT, REFUND_SW, ...LICENSE('sw'),
    ],
    defaults: { sub: 'โปรแกรม', platforms: ['Windows'], keyType: 'คีย์ต่อเครื่อง', deps: 'ไม่ต้องติดตั้งเพิ่ม', install: ['ดาวน์โหลดไฟล์ติดตั้งจากคลังของที่ซื้อ', 'ดับเบิลคลิกไฟล์ แล้วกดถัดไปจนเสร็จ', 'เปิดโปรแกรมจากไอคอนบนหน้าจอ'], activation: ['คัดลอกคีย์จากคลังของที่ซื้อ', 'เปิดโปรแกรม › เมนูตั้งค่า › ใส่คีย์', 'กดยืนยัน ระบบผูกคีย์กับเครื่องนี้'], support: 'อัปเดตฟรี 1 ปี · ตอบแชตภายใน 24 ชม.', refund: 'คืนเงินเต็มจำนวนภายใน 7 วัน ถ้าติดตั้งหรือใช้งานไม่ได้', trial: true, trialDays: '14 วัน', ...licDefaults('sw') },
  },
  game: {
    key: 'game', name: 'เกม · ปลั๊กอิน', sub: 'เกม ม็อด ส่วนเสริม', icon: 'game', color: '#0E9384', bg: '#E3F7F4', layout: 'sw',
    fields: [],
    defaults: {},
  },
  bot: {
    key: 'bot', name: 'บอท · ระบบอัตโนมัติ', sub: 'บอทแชต ลิงก์ทดลอง', icon: 'robot', color: '#15803D', bg: '#E5F8EC', layout: 'bot',
    fields: [
      { id: 'sub', label: 'เป็นแบบไหน', kind: 'chips', step: 'files', options: ['บอทแชต', 'ผู้ช่วย AI', 'ระบบอัตโนมัติ'], required: true, hint: 'ใช้จัดหมวดย่อยบนหน้าค้นหา: บอทแชต · ผู้ช่วย AI · ระบบอัตโนมัติ' },
      { id: 'platform', label: 'ใช้กับแพลตฟอร์มไหน', kind: 'multi', step: 'files', options: ['LINE OA', 'Facebook Messenger', 'Instagram', 'เว็บไซต์', 'TikTok', 'Telegram', 'Google Sheets', 'n8n / Make'], required: true },
      { id: 'buyerNeeds', label: 'ผู้ซื้อต้องมีบัญชี / API key อะไร', kind: 'list', step: 'files', required: true, placeholder: 'เช่น บัญชี LINE OA (ฟรี) · Channel access token' },
      { id: 'features', label: 'บอททำอะไรได้บ้าง', kind: 'list', step: 'details', required: true },
      { id: 'setupMode', label: 'การติดตั้ง', kind: 'chips', step: 'details', options: ['ติดตั้งให้ฟรี 1 ครั้ง', 'ผู้ซื้อติดตั้งเองตามคู่มือ', 'มีค่าติดตั้งแยก'], required: true },
      { id: 'setup', label: 'ขั้นตอนติดตั้ง', kind: 'list', step: 'details', required: true },
      { id: 'limits', label: 'ข้อจำกัด / โควตา', kind: 'text', step: 'details', required: true, placeholder: 'เช่น ตอบได้ 1,000 ข้อความ/เดือน ตามโควตา LINE ฟรี' },
      { id: 'trial', label: 'เปิดทดลองฟรี', kind: 'toggle', step: 'price' },
      { id: 'trialDays', label: 'ทดลองได้กี่วัน', kind: 'chips', step: 'price', options: ['3 วัน', '7 วัน', '14 วัน'], when: (s) => on(s.trial), required: (s) => on(s.trial) },
      { id: 'trialLink', label: 'ลิงก์ทดลองคุย', kind: 'text', step: 'price', when: (s) => on(s.trial), required: (s) => on(s.trial), placeholder: 'line.me/R/ti/p/@…', pattern: /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i, patternNote: 'ต้องเป็นลิงก์ เช่น line.me/R/ti/p/@ร้าน' },
      SUPPORT, refundField(['ยกเลิกรายเดือนได้ทุกเมื่อ ใช้ได้ถึงสิ้นรอบที่จ่ายแล้ว · ค่าติดตั้งคืนได้ถ้ายังไม่ได้ติดตั้ง', ...REFUND_STD]), ...LICENSE('bot'),
    ],
    defaults: { sub: 'บอทแชต', platform: ['LINE OA'], buyerNeeds: ['บัญชี LINE OA (สมัครฟรี)'], setupMode: 'ติดตั้งให้ฟรี 1 ครั้ง', setup: ['ส่งบรีฟร้านและเมนูในแชต', 'ครีเอเตอร์นัดเวลาติดตั้ง (ประมาณ 30 นาที)', 'ทดสอบคุยกับบอทแล้วเปิดใช้งานจริง'], trial: true, trialDays: '7 วัน', support: 'ดูแลฟรี 30 วัน · แก้คำตอบได้ไม่จำกัด', refund: 'ยกเลิกรายเดือนได้ทุกเมื่อ ใช้ได้ถึงสิ้นรอบที่จ่ายแล้ว · ค่าติดตั้งคืนได้ถ้ายังไม่ได้ติดตั้ง', ...licDefaults('bot') },
  },
  course: {
    key: 'course', name: 'คอร์สและอีบุ๊ก', sub: 'บทเรียนวิดีโอ ไฟล์ประกอบ', icon: 'cap', color: '#C2410C', bg: '#FFF0E3', layout: 'course',
    fields: [
      { id: 'sub', label: 'รูปแบบ', kind: 'chips', step: 'files', options: ['คอร์สวิดีโอ', 'อีบุ๊ก'], required: true },
      { id: 'lessons', label: 'สารบัญ (ชื่อตอนหรือบท · ความยาว)', kind: 'list', step: 'files', required: true, min: 2, placeholder: 'เช่น ตอนที่ 1 · ปูพื้น AI ทำภาพสินค้า · 09:30' },
      { ...FILES('ไฟล์เนื้อหา', 'คอร์สวิดีโอ: อัปวิดีโอทุกตอน (หรือรวมเป็น ZIP) · อีบุ๊ก: ไฟล์ PDF หรือ EPUB · แนบไฟล์ประกอบ PDF ZIP ได้'), label: 'ไฟล์เนื้อหา (วิดีโอ / อีบุ๊ก)' },
      { id: 'freeLessons', label: 'เปิดให้ดูหรืออ่านฟรีกี่ตอน', kind: 'chips', step: 'files', options: ['ไม่มี', '1 ตอน', '2 ตอน', '3 ตอน'], required: true },
      { id: 'materials', label: 'ไฟล์ประกอบที่ได้', kind: 'multi', step: 'files', options: ['สรุป PDF', 'ไฟล์งานตัวอย่าง', 'พรอมต์สำเร็จรูป', 'เทมเพลต', 'กลุ่มถาม-ตอบ'], required: true },
      { id: 'level', label: 'ระดับ', kind: 'chips', step: 'details', options: ['มือใหม่', 'กลาง', 'ขั้นสูง'], required: true },
      { id: 'prereq', label: 'ต้องรู้หรือมีอะไรก่อนเรียน', kind: 'text', step: 'details', required: true, placeholder: 'เช่น มีมือถือหรือคอม ไม่ต้องมีพื้นฐาน' },
      { id: 'duration', label: 'ความยาวรวม', kind: 'text', step: 'details', required: true, placeholder: 'เช่น 12 ตอน · 3 ชม.' },
      { id: 'outcomes', label: 'เรียนจบแล้วทำอะไรได้', kind: 'list', step: 'details', required: true },
      { id: 'access', label: 'ดูได้นานแค่ไหน', kind: 'chips', step: 'license', options: ['ไม่จำกัดเวลา', '1 ปี', '6 เดือน'], when: (s) => str(s.sub) !== 'อีบุ๊ก', required: (s) => str(s.sub) !== 'อีบุ๊ก', hint: 'ไม่จำกัดเวลา = ตราบที่คอร์สยังเปิดบน LUMI · ถ้าจะปิดคอร์สต้องแจ้งผู้เรียนล่วงหน้า 30 วัน' },
      { id: 'certificate', label: 'มีใบรับรองเมื่อเรียนจบ', kind: 'toggle', step: 'license', when: (s) => str(s.sub) !== 'อีบุ๊ก' },
      refundField(['คืนเงินได้ภายใน 7 วัน ถ้าเรียนไม่เกิน 2 ตอน', ...REFUND_STD]), ...LICENSE('course'),
    ],
    defaults: { sub: 'คอร์สวิดีโอ', freeLessons: '1 ตอน', materials: ['สรุป PDF'], level: 'มือใหม่', access: 'ไม่จำกัดเวลา', certificate: true, refund: 'คืนเงินได้ภายใน 7 วัน ถ้าเรียนไม่เกิน 2 ตอน', ...licDefaults('course', 'ใช้ส่วนตัว') },
  },
  font: {
    key: 'font', name: 'ฟอนต์ · สติกเกอร์', sub: 'ฟอนต์ สติกเกอร์ PNG ไอคอน พรีเซ็ต', icon: 'font', color: '#D6336C', bg: '#FDEBF2', layout: 'font',
    fields: [
      { id: 'sub', label: 'เป็นแบบไหน', kind: 'chips', step: 'files', options: ['ฟอนต์', 'สติกเกอร์ PNG', 'ไอคอน', 'พรีเซ็ต / LUT', 'แปรง'], required: true, hint: 'ใช้จัดหมวดย่อยบนหน้าค้นหา: สติกเกอร์ · ฟอนต์ พรีเซ็ต ไอคอน' },
      FILES('ไฟล์ที่ผู้ซื้อได้รับ', 'OTF TTF PNG SVG CUBE XMP ABR'),
      { id: 'formats', label: 'นามสกุลไฟล์', kind: 'multi', step: 'files', options: ['OTF', 'TTF', 'WOFF2', 'PNG', 'SVG', 'LUT (.cube)', 'XMP', 'ABR'], required: true },
      { id: 'count', label: 'จำนวนในชุด', kind: 'text', step: 'files', required: true, placeholder: 'เช่น 3 น้ำหนัก · 24 ตัว · 12 พรีเซ็ต' },
      { id: 'languages', label: 'รองรับภาษา / ตัวอักษร', kind: 'multi', step: 'details', options: ['ไทย', 'อังกฤษ', 'ตัวเลข', 'สัญลักษณ์', 'วรรณยุกต์ครบ'], when: (s) => str(s.sub) === 'ฟอนต์', required: (s) => str(s.sub) === 'ฟอนต์' },
      { id: 'compat', label: 'ใช้กับแอปอะไรได้', kind: 'text', step: 'details', required: true, placeholder: 'เช่น Windows macOS Canva Photoshop' },
      { id: 'install', label: 'วิธีติดตั้ง / ใช้งาน', kind: 'list', step: 'details', required: true },
      ...LICENSE('font'),
    ],
    defaults: { sub: 'ฟอนต์', formats: ['OTF', 'TTF'], languages: ['ไทย', 'อังกฤษ', 'ตัวเลข'], compat: 'Windows · macOS · Canva · Photoshop · Word', install: ['แตกไฟล์ ZIP ที่ได้', 'ดับเบิลคลิกไฟล์ .otf แล้วกด “ติดตั้ง”', 'เปิดแอป เลือกฟอนต์ชื่อเดียวกับที่ซื้อ'], ...licDefaults('font') },
  },
  hire: {
    key: 'hire', name: 'งานจ้าง', sub: 'แพ็กเกจ รับบรีฟ', icon: 'pen', color: '#B45309', bg: '#FFF4DB', layout: 'hire',
    fields: [
      { id: 'deliverables', label: 'งานที่ส่งมอบ', kind: 'list', step: 'files', required: true, placeholder: 'เช่น มาสคอต 1 ตัว + 3 ท่าทาง' },
      { id: 'formats', label: 'ไฟล์ที่ส่งให้', kind: 'multi', step: 'files', options: ['PNG', 'JPG', 'AI', 'PSD', 'SVG', 'PDF', 'MP4', 'ไฟล์ซอร์ส'], required: true },
      { id: 'briefNeeds', label: 'ผู้ซื้อต้องเตรียมอะไรในบรีฟ', kind: 'list', step: 'details', required: true, placeholder: 'เช่น ชื่อร้านและสีที่ชอบ' },
      { id: 'timeline', label: 'ส่งงานภายใน', kind: 'chips', step: 'price', options: ['1–3 วัน', '3–7 วัน', '7–14 วัน', '14–30 วัน'], required: true },
      { id: 'revisions', label: 'แก้ไขได้', kind: 'chips', step: 'price', options: ['1 ครั้ง', '2 ครั้ง', '3 ครั้ง', '5 ครั้ง'], required: true },
      { id: 'rights', label: 'สิทธิ์ในงานที่ส่ง', kind: 'chips', step: 'license', options: ['ใช้เชิงพาณิชย์ได้ + ไฟล์ต้นฉบับ', 'ใช้เชิงพาณิชย์ได้', 'ใช้ส่วนตัวเท่านั้น'], required: true },
      { id: 'copyright', label: 'ลิขสิทธิ์งานที่ส่งเป็นของใคร', kind: 'chips', step: 'license', options: ['โอนสิทธิ์ทั้งหมดที่ครีเอเตอร์มีให้ผู้ซื้อเมื่อชำระครบ', 'ครีเอเตอร์ถือไว้ ผู้ซื้อได้สิทธิ์ใช้'], required: true },
      { id: 'portfolio', label: 'ขอนำไปโชว์ในพอร์ต', kind: 'toggle', step: 'license' },
      IP_OK, refundField(REFUND_HIRE),
    ],
    defaults: { formats: ['PNG', 'AI'], timeline: '3–7 วัน', revisions: '3 ครั้ง', rights: 'ใช้เชิงพาณิชย์ได้', copyright: 'โอนสิทธิ์ทั้งหมดที่ครีเอเตอร์มีให้ผู้ซื้อเมื่อชำระครบ', portfolio: true, briefNeeds: ['ชื่อร้านหรือแบรนด์', 'สีหรือสไตล์ที่ชอบ', 'ภาพอ้างอิง 1–3 ภาพ', 'จะเอาไปใช้ทำอะไร'], refund: 'คืนเต็มจำนวนถ้ายังไม่เริ่มงาน หรือส่งงานไม่ตรงบรีฟ' },
  },
  // filled in below (added 2 Nov 2026)
  media: undefined as unknown as TypeSpec,
  skill: undefined as unknown as TypeSpec,
  data: undefined as unknown as TypeSpec,
}
// เกม · ปลั๊กอิน shares the software checklist, with its own sub-types and platforms.
SPECS.game.fields = SPECS.sw.fields.map((f) =>
  f.id === 'sub' ? { ...f, options: ['เกม', 'ซอร์สโค้ดเกม', 'ปลั๊กอิน', 'ส่วนขยาย Chrome', 'ม็อด'], hint: 'ใช้จัดหมวดย่อยบนหน้าค้นหา: เกม · ปลั๊กอิน · ส่วนขยาย Chrome' }
    : f.id === 'platforms' ? { ...f, options: ['Windows', 'macOS', 'เว็บ', 'Android', 'iOS', 'WordPress', 'Shopify', 'Chrome', 'Unity', 'Godot'] }
      : f.id === 'licAllowed' ? { ...f, options: licRows('game') } : f)
SPECS.game.defaults = { ...SPECS.sw.defaults, sub: 'เกม', keyType: 'ไม่ต้องใช้คีย์', ...licDefaults('game') }

// ---------- 3 categories added 2 Nov 2026 (approved): วิดีโอ เสียง และเพลง · Agent Skills · ชุดข้อมูล
SPECS.media = {
  key: 'media', name: 'วิดีโอ เสียง เพลง', sub: 'วิดีโอ AI เพลง เสียงพากย์', icon: 'play', color: '#9333EA', bg: '#F5EBFF', layout: 'media',
  fields: [
    { id: 'sub', label: 'เป็นแบบไหน', kind: 'chips', step: 'files', options: ['วิดีโอ AI', 'เสียงพากย์ AI', 'เพลงต้นฉบับ', 'เอฟเฟกต์เสียง', 'เทมเพลตตัดต่อวิดีโอ'], required: true },
    FILES('ไฟล์ที่ผู้ซื้อได้รับ', 'MP4 MOV WAV MP3 หรือไฟล์เทมเพลต · ไม่มีลายน้ำ · สแกนไวรัสเบื้องต้นทุกไฟล์'),
    { id: 'count', label: 'จำนวนชิ้นในชุด', kind: 'text', step: 'files', required: true, placeholder: 'เช่น 1 คลิป หรือ 10 เพลง' },
    { id: 'duration', label: 'ความยาว', kind: 'text', step: 'files', required: true, placeholder: 'เช่น 15 วินาที · หรือ รวม 32 นาที (เพลงละ 2–4 นาที)' },
    { id: 'formats', label: 'นามสกุลไฟล์', kind: 'multi', step: 'files', options: ['MP4', 'MOV', 'WAV', 'MP3', 'เทมเพลต CapCut', 'Premiere (.prproj)', 'After Effects (.aep)', 'SRT (ซับไตเติล)'], required: true },
    { id: 'quality', label: 'ความละเอียด / บิตเรต', kind: 'chips', step: 'files', options: ['4K 30fps', '1080p 60fps', '1080p 30fps', '9:16 1080×1920', 'WAV 48kHz 24-bit', 'MP3 320 kbps'], required: true },
    { id: 'appVersion', label: 'แอปตัดต่อที่ต้องใช้ + เวอร์ชัน', kind: 'text', step: 'files', when: (s) => str(s.sub) === 'เทมเพลตตัดต่อวิดีโอ', required: (s) => str(s.sub) === 'เทมเพลตตัดต่อวิดีโอ', placeholder: 'เช่น CapCut มือถือ 12.0 ขึ้นไป (ฟรี)' },
    { id: 'aiTool', label: 'สร้างด้วยเครื่องมือ AI อะไร', kind: 'chips', step: 'details', options: ['Runway', 'Kling', 'Sora', 'Veo', 'Suno', 'ElevenLabs', 'CapCut AI', 'ไม่ได้ใช้ AI', 'อื่น ๆ'], required: true, hint: 'แสดงบนหน้าผลงานให้ผู้ซื้อรู้ที่มา' },
    { id: 'aiPlan', label: 'ใช้แผนไหนของเครื่องมือ AI', kind: 'chips', step: 'details', options: ['แผนเสียเงิน (ใช้เชิงพาณิชย์ได้)', 'แผนฟรี'], when: (s) => !['', 'ไม่ได้ใช้ AI'].includes(str(s.aiTool)), required: (s) => !['', 'ไม่ได้ใช้ AI'].includes(str(s.aiTool)), pattern: /^แผนเสียเงิน/, patternNote: 'แผนฟรีของเครื่องมือส่วนใหญ่ห้ามนำผลงานไปขาย · ลงขายไม่ได้', hint: 'ผลงานจากแผนฟรีมักขายเชิงพาณิชย์ไม่ได้' },
    { id: 'howUse', label: 'วิธีใช้งาน (ทีละขั้น)', kind: 'list', step: 'details', required: true },
    { id: 'noClone', label: 'ยืนยัน: ไม่ได้เลียนเสียงหรือหน้าบุคคลจริงโดยไม่ได้รับอนุญาต', kind: 'toggle', step: 'license', required: true, mustBeOn: true, hint: 'ห้ามโคลนเสียงคนดัง/บุคคลจริง · ฝ่าฝืนถูกถอดผลงาน' },
    { id: 'musicLic', label: 'สิทธิ์เพลง / เสียง', kind: 'chips', step: 'license', options: ['ผู้ขายรับรองว่าใช้ในคลิปโซเชียลได้', 'ผู้ขายรับรองว่าใช้ในโฆษณา ทีวี และสตรีมได้', 'ใช้ส่วนตัวเท่านั้น'], required: true, hint: 'หากผู้ซื้อถูกระบบแพลตฟอร์มแจ้งลิขสิทธิ์ ผู้ซื้อติดต่อคุณหรือขอคืนเงินได้' },
    REFUND, ...LICENSE('media'),
  ],
  defaults: { sub: 'วิดีโอ AI', formats: ['MP4'], quality: '1080p 30fps', musicLic: 'ผู้ขายรับรองว่าใช้ในคลิปโซเชียลได้', howUse: ['ดาวน์โหลดไฟล์จากคลังของที่ซื้อ', 'นำเข้าแอปตัดต่อหรืออัปโหลดขึ้นโซเชียลได้ทันที'], refund: 'คืนเงินได้ภายใน 7 วัน ถ้าไฟล์เปิดไม่ได้หรือไม่ตรงคำอธิบาย', ...licDefaults('media') },
}
SPECS.skill = {
  key: 'skill', name: 'Agent Skills', sub: 'สกิล ชุดความรู้ให้ AI agent', icon: 'bulb', color: '#0F766E', bg: '#E2F6F2', layout: 'skill',
  fields: [
    { id: 'platforms', label: 'ใช้กับ AI agent ตัวไหน', kind: 'multi', step: 'files', options: ['Claude (Agent Skills)', 'ChatGPT (GPTs / Projects)', 'Cursor (Rules / Skills)', 'Gemini Gems', 'Grok', 'OpenAI Agents SDK', 'n8n / LangChain agent'], required: true },
    FILES('ไฟล์สกิล', 'เช่น ZIP ที่มี SKILL.md สคริปต์ เอกสารอ้างอิง · สแกนไวรัสเบื้องต้นทุกไฟล์'),
    { id: 'contents', label: 'ในชุดมีไฟล์อะไรบ้าง', kind: 'list', step: 'files', required: true, placeholder: 'เช่น SKILL.md — คำสั่งหลักของสกิล' },
    { id: 'version', label: 'เวอร์ชัน', kind: 'text', step: 'files', required: true, placeholder: 'เช่น v1.0' },
    { id: 'changelog', label: 'ประวัติอัปเดต', kind: 'list', step: 'files' },
    { id: 'features', label: 'สกิลนี้ทำให้ agent ทำอะไรได้', kind: 'list', step: 'details', required: true },
    { id: 'install', label: 'วิธีติดตั้ง (ทีละขั้น)', kind: 'list', step: 'details', required: true, min: 2 },
    { id: 'buyerNeeds', label: 'ผู้ซื้อต้องมีบัญชี / แพ็กเกจอะไร', kind: 'list', step: 'details', required: true, placeholder: 'เช่น Claude Pro ขึ้นไป (เปิดใช้ Skills ได้)' },
    { id: 'examples', label: 'ตัวอย่างคำสั่งที่ใช้ได้', kind: 'list', step: 'details', placeholder: 'เช่น “ตอบลูกค้าที่ถามค่าส่งให้หน่อย”' },
    SUPPORT, refundField(['คืนเงินได้ภายใน 7 วัน ถ้าติดตั้งไม่ได้', ...REFUND_STD]), ...LICENSE('skill'),
  ],
  defaults: { platforms: ['Claude (Agent Skills)'], version: 'v1.0', install: ['ดาวน์โหลดไฟล์ ZIP จากคลังของที่ซื้อ', 'เปิด Claude › Settings › Capabilities › Skills › Upload skill', 'เลือกไฟล์ ZIP แล้วเปิดใช้งาน'], support: 'อัปเดตฟรี 6 เดือน · ตอบแชตภายใน 24 ชม.', refund: 'คืนเงินได้ภายใน 7 วัน ถ้าติดตั้งไม่ได้', ...licDefaults('skill') },
}
SPECS.data = {
  key: 'data', name: 'ชุดข้อมูล', sub: 'CSV JSON สำหรับแอป/AI', icon: 'grid', color: '#1D4ED8', bg: '#E8EFFF', layout: 'data',
  fields: [
    FILES('ไฟล์ชุดข้อมูล', 'CSV JSON Parquet ฯลฯ · สแกนไวรัสเบื้องต้นทุกไฟล์'),
    { ...FILES('ไฟล์ตัวอย่างให้โหลดฟรี (ไม่บังคับ)', 'ไม่เกิน 100 แถว · ผู้ซื้อโหลดดูได้ก่อนจ่าย ช่วยให้ขายง่ายขึ้น', false), id: 'sample' },
    { id: 'formats', label: 'รูปแบบไฟล์', kind: 'multi', step: 'files', options: ['CSV', 'JSON', 'JSONL', 'Parquet', 'XLSX', 'SQL'], required: true },
    { id: 'size', label: 'ขนาด (แถว · คอลัมน์ · MB)', kind: 'text', step: 'files', required: true, placeholder: 'เช่น 5,000 แถว · 12 คอลัมน์ · 3.2 MB' },
    { id: 'columns', label: 'คอลัมน์ / โครงสร้างข้อมูล', kind: 'list', step: 'details', required: true, min: 2, placeholder: 'เช่น name — ชื่อเมนู (ข้อความ)' },
    { id: 'source', label: 'แหล่งที่มาของข้อมูล', kind: 'textarea', step: 'details', required: true, placeholder: 'เช่น รวบรวมเองจากเมนูร้านที่ได้รับอนุญาต 120 ร้าน ระหว่าง ม.ค.–ก.ย. 2569' },
    { id: 'updates', label: 'การอัปเดต', kind: 'chips', step: 'details', options: ['ครั้งเดียว', 'อัปเดตรายเดือน', 'อัปเดตรายไตรมาส'], required: true },
    { id: 'useCases', label: 'นำไปใช้ทำอะไรได้', kind: 'list', step: 'details', required: true },
    { id: 'rights', label: 'ยืนยัน: ฉันมีสิทธิ์นำข้อมูลนี้มาขาย/แจกต่อ', kind: 'toggle', step: 'license', required: true, mustBeOn: true },
    { id: 'noPII', label: 'ยืนยัน: ไม่มีข้อมูลส่วนบุคคล (ชื่อ เบอร์ อีเมล เลขบัตร ที่อยู่)', kind: 'toggle', step: 'license', required: true, mustBeOn: true, hint: 'ตาม PDPA · ทีม LUMI ตรวจก่อนขึ้นขาย และลบได้ทันทีถ้าพบข้อมูลส่วนบุคคลภายหลัง' },
    REFUND, ...LICENSE('data'),
  ],
  defaults: { formats: ['CSV'], updates: 'ครั้งเดียว', refund: REFUND_STD[0], ...licDefaults('data') },
}

// B6: every listing says whether (and how) AI was used; shown on the product page. Media asks this with its own aiTool chips.
const AI_USE: Field = { id: 'aiUse', label: 'ใช้ AI ทำไหม', kind: 'chips', step: 'details', options: ['ใช้ AI ทั้งหมด', 'ใช้ AI บางส่วน แล้วแต่งต่อเอง', 'ไม่ได้ใช้ AI'], required: true, hint: 'แสดงบนหน้าผลงานให้ผู้ซื้อรู้ · บอกตามจริง' }
const AI_TOOLS: Field = { id: 'aiTools', label: 'เครื่องมือ AI ที่ใช้', kind: 'text', step: 'details', when: (s) => !!str(s.aiUse) && str(s.aiUse) !== 'ไม่ได้ใช้ AI', required: (s) => !!str(s.aiUse) && str(s.aiUse) !== 'ไม่ได้ใช้ AI', placeholder: 'เช่น Midjourney, ChatGPT, Claude, Suno' }
for (const sp of Object.values(SPECS)) if (sp.key !== 'media' && !sp.fields.some((f) => f.id === 'aiUse')) sp.fields.push(AI_USE, AI_TOOLS)
SPECS.img.defaults = { ...SPECS.img.defaults, aiUse: 'ใช้ AI ทั้งหมด' }
/** Starting values for a NEW listing. Support/update terms are left for the creator to write (never pre-promised). */
export function newSpec(t: SellType): Spec {
  const { support: _support, ...rest } = SPECS[t].defaults
  return { ...rest }
}

export const SELL_TYPES = Object.values(SPECS)

/** What the “files” upload accepts per type: extensions, max size per file, max file count. */
const UP: Partial<Record<SellType, { exts: string[]; maxMB: number }>> = {
  img: { exts: ['png', 'jpg', 'jpeg', 'webp', 'psd', 'svg', 'tif', 'tiff', 'zip'], maxMB: 200 },
  tpl: { exts: ['psd', 'ai', 'fig', 'pptx', 'key', 'xlsx', 'html', 'pdf', 'indd', 'zip'], maxMB: 500 },
  sw: { exts: ['exe', 'msi', 'dmg', 'pkg', 'apk', 'aab', 'ipa', 'appimage', 'deb', 'zip'], maxMB: 2048 },
  game: { exts: ['exe', 'msi', 'dmg', 'pkg', 'apk', 'aab', 'ipa', 'zip', 'unitypackage', 'crx', 'jar', 'html'], maxMB: 2048 },
  media: { exts: ['mp4', 'mov', 'webm', 'wav', 'mp3', 'm4a', 'flac', 'srt', 'prproj', 'aep', 'zip'], maxMB: 2048 },
  font: { exts: ['otf', 'ttf', 'woff', 'woff2', 'png', 'svg', 'cube', 'xmp', 'abr', 'zip'], maxMB: 500 },
  skill: { exts: ['zip', 'md', 'txt', 'json', 'yaml', 'yml', 'py', 'js', 'ts', 'pdf'], maxMB: 100 },
  data: { exts: ['csv', 'json', 'jsonl', 'parquet', 'xlsx', 'sql', 'zip', 'gz'], maxMB: 1024 },
}
export const MAX_FILES = 20
const VIDEO_EXTS = ['mp4', 'mov', 'webm', 'm4v']
export function uploadRule(t: SellType | null, s?: Spec, fieldId = 'files') {
  if (t === 'data' && fieldId === 'sample') return { exts: ['csv', 'json', 'jsonl', 'xlsx', 'txt'], maxMB: 10 }
  if (t === 'course') return str(s?.sub) === 'อีบุ๊ก' ? { exts: ['pdf', 'epub', 'zip'], maxMB: 200 } : { exts: [...VIDEO_EXTS, 'pdf', 'zip'], maxMB: 4096 }
  return (t && UP[t]) || { exts: [] as string[], maxMB: 500 }
}
const isEbook = (s: Spec, label = '') => str(s.sub) === 'อีบุ๊ก' || (!str(s.sub) && /อีบุ๊ก/.test(label))
export const visible = (f: Field, s: Spec) => !f.when || f.when(s)
const isReq = (f: Field, s: Spec) => visible(f, s) && (typeof f.required === 'function' ? f.required(s) : !!f.required)
function filled(f: Field, v: SpecValue | undefined) {
  if (f.kind === 'toggle') return f.mustBeOn ? v === true : true
  if (f.kind === 'files') { const fs = filesOf(v); return fs.length >= (f.min ?? 1) && fs.every((x) => x.scan === 'ok') }
  if (f.kind === 'multi' || f.kind === 'list') return arr(v).length >= (f.min ?? 1)
  if (f.pattern && str(v) && !f.pattern.test(str(v))) return false
  return !!str(v)
}

/** Listing draft shape stored by the sell wizard. */
export interface ListingDraft {
  id: string
  type: SellType | null
  step: number
  title: string
  use: string
  desc: string
  tags: string[]
  covers: string[]
  spec: Spec
  free: boolean
  tips: boolean
  options: { id: string; label: string; sub: string; price: number; on: boolean; suffix?: string }[]
  updatedAt: number
  publishedId?: string
  /** Content fingerprint of the live version when an edit started (see contentSig). */
  origSig?: string
}

export interface CheckItem { id: string; label: string; ok: boolean; step: number; note?: string }
const STEP_NO: Record<Step, number> = { files: 1, details: 2, price: 3, license: 4 }

/** The pre-publish auto-check. Every REQUIRED item must be ok before “ลงขายเลย” is enabled. */
export function checkListing(d: ListingDraft): CheckItem[] {
  if (!d.type) return [{ id: 'type', label: 'เลือกประเภทผลงาน', ok: false, step: 0 }]
  const t = SPECS[d.type]
  const out: CheckItem[] = [
    { id: 'covers', label: d.type === 'hire' ? 'รูปผลงานตัวอย่าง (อย่างน้อย 1)' : 'รูปหน้าปก (อย่างน้อย 1)', ok: d.covers.length > 0, step: 1 },
  ]
  for (const f of t.fields.filter((f) => isReq(f, d.spec) && f.step === 'files')) out.push(chk(f, d))
  if (d.type === 'course' && !isEbook(d.spec)) {
    const fs = filesOf(d.spec.files), n = arr(d.spec.lessons).length
    const vids = fs.filter((x) => VIDEO_EXTS.some((e) => x.name.toLowerCase().endsWith('.' + e))).length
    const zip = fs.some((x) => x.name.toLowerCase().endsWith('.zip'))
    out.push({ id: 'lessonFiles', label: `วิดีโอครบทุกตอน (${vids}/${n})`, ok: n > 0 && (vids >= n || zip), step: 1, note: 'อัปวิดีโอให้เท่าจำนวนตอนในสารบัญ หรือรวมเป็น ZIP' })
  }
  out.push({ id: 'title', label: 'ชื่อผลงาน', ok: d.title.trim().length >= 4, step: 2, note: 'อย่างน้อย 4 ตัวอักษร' })
  out.push({ id: 'use', label: 'เหมาะกับใคร / ใช้ทำอะไร', ok: d.use.trim().length >= 4, step: 2 })
  out.push({ id: 'desc', label: 'รายละเอียด', ok: d.desc.trim().length >= 10, step: 2, note: 'อย่างน้อย 10 ตัวอักษร' })
  for (const f of t.fields.filter((f) => isReq(f, d.spec) && f.step === 'details')) out.push(chk(f, d))
  const free = d.free && d.type !== 'hire'
  const priced = free || d.options.some((o) => o.on && o.price > 0)
  out.push({ id: 'price', label: free ? 'แจกฟรี' : 'ราคา (เปิดขายอย่างน้อย 1 แบบ)', ok: priced, step: 3 })
  for (const f of t.fields.filter((f) => isReq(f, d.spec) && f.step === 'price')) out.push(chk(f, d))
  for (const f of t.fields.filter((f) => isReq(f, d.spec) && f.step === 'license')) out.push(chk(f, d))
  return out
}
function chk(f: Field, d: ListingDraft): CheckItem {
  const ok = filled(f, d.spec[f.id])
  let note: string | undefined
  if (f.kind === 'files') { const fs = filesOf(d.spec[f.id]); note = fs.some((x) => x.scan === 'scan') ? 'กำลังสแกนไวรัส' : fs.some((x) => x.scan === 'fail') ? 'มีไฟล์ไม่ผ่านการสแกน' : undefined }
  if ((f.kind === 'list') && (f.min ?? 1) > 1) note = `อย่างน้อย ${f.min} รายการ`
  if (f.pattern && str(d.spec[f.id]) && !ok) note = f.patternNote
  if (f.kind === 'files' && ok) {
    const r = uploadRule(d.type, d.spec, f.id)
    if (r.exts.length && filesOf(d.spec[f.id]).some((x) => !r.exts.includes((x.name.split('.').pop() ?? '').toLowerCase()))) return { id: f.id, label: f.label, ok: false, step: STEP_NO[f.step], note: 'มีไฟล์ที่ไม่ตรงรูปแบบที่เลือก' }
  }
  return { id: f.id, label: f.label, ok, step: STEP_NO[f.step], note }
}
export const completion = (d: ListingDraft) => { const c = checkListing(d); return d.type ? Math.round((c.filter((x) => x.ok).length / c.length) * 100) : 0 }

// ---------- product page content
export function sellTypeOf(p: Product): SellType {
  const l = p.label ?? ''
  if (p.st) return p.st
  if (p.type === 'media') return 'media'
  if (p.type === 'skill') return 'skill'
  if (p.type === 'data') return 'data'
  if (p.kind === 'commission') return 'hire'
  if (p.kind === 'course') return 'course'
  if (p.kind === 'bot' || p.type === 'bot') return 'bot'
  if (/ฟอนต์|พรีเซ็ต|ไอคอน|สติกเกอร์/.test(l)) return 'font'
  if (/เกม|ปลั๊กอิน|ส่วนขยาย/.test(l)) return 'game'
  if (p.type === 'tool') return /อัตโนมัติ|ผู้ช่วย/.test(l) ? 'bot' : 'sw'
  if (p.type === 'tpl') return 'tpl'
  return 'img'
}
/** The one taxonomy: every work belongs to one of the 11 sell types (home chips, cards, favorites, search groups). */
export const typeOf = (p: Product) => SPECS[sellTypeOf(p)]
export const SELL_TYPE_ORDER: SellType[] = ['img', 'tpl', 'media', 'sw', 'game', 'bot', 'skill', 'data', 'course', 'font', 'hire']

export function layoutOf(p: Product): DetailKind {
  if (p.dk) return p.dk
  if (p.price === 0 && p.kind !== 'commission') return 'free'
  return SPECS[sellTypeOf(p)].layout
}

/** Plausible complete spec for the built-in SAMPLE works (they predate the wizard). */
/** English subject for sample prompts, from the image file name (sample prompts are English-only). */
const engSubject = (p: Product) => `detailed illustration of ${(p.image?.src ?? 'artwork').replace(/^.*\//, '').replace(/\.\w+$/, '').replace(/^[a-z]_/, '').replace(/[_-]+/g, ' ')}`
export function specOf(p: Product): Spec {
  if (p.spec) return p.spec
  const t = sellTypeOf(p)
  const d: Spec = { ...SPECS[t].defaults, ipOk: true, ...(t === 'media' || t === 'img' ? {} : { aiUse: 'ใช้ AI บางส่วน แล้วแต่งต่อเอง', aiTools: 'ChatGPT, Claude' }) }
  const slug = p.id
  const l = p.label ?? ''
  if (t === 'img') Object.assign(d, { count: /ชุด (\d+)/.exec(p.title)?.[1] ? `${/ชุด (\d+)/.exec(p.title)![1]} ภาพ` : '1 ภาพ', files: [JSON.stringify(/ชุด (\d+)/.exec(p.title) ? { name: `${slug}-${/ชุด (\d+)/.exec(p.title)![1]}views.zip`, size: '38 MB', scan: 'ok' } : { name: `${slug}-4k.png`, size: '8.4 MB', scan: 'ok' })], ...(/ชุด (\d+)/.exec(p.title) ? { formats: ['PNG', 'ZIP'] } : {}), sellPrompt: !!p.hasPrompt, prompt: p.hasPrompt ? `/imagine prompt: ${engSubject(p)}, soft cinematic light, rich thai details, ultra detailed --ar 3:4 --stylize 600` : undefined, model: p.hasPrompt ? 'Midjourney v7' : undefined, aiTools: p.hasPrompt ? 'Midjourney v7' : 'Midjourney, Photoshop', settings: p.hasPrompt ? '--ar 3:4 --stylize 600 --seed 2569' : undefined, aspect: p.image && p.image.w > p.image.h ? '16:9' : p.image && p.image.w === p.image.h ? '1:1' : '3:4' })
  if (t === 'tpl') {
    const web = /เว็บ/.test(l), print = /พิมพ์/.test(l)
    Object.assign(d, web ? { apps: ['เว็บ (HTML)', 'Figma'], appVersion: 'เบราว์เซอร์ใดก็ได้ · Figma ฟรี', formats: ['HTML', 'FIG'], count: '1 หน้า · 6 ส่วน', size: 'รองรับมือถือและคอม', files: [JSON.stringify({ name: 'bakery-site.zip', size: '6.1 MB', scan: 'ok' })], howOpen: ['แตกไฟล์ ZIP', 'เปิด index.html ด้วยเบราว์เซอร์เพื่อดู', 'แก้ข้อความใน Figma หรือไฟล์ HTML แล้วอัปโหลดขึ้นโฮสต์ (เช่น GitHub Pages ฟรี)'] }
      : print ? { apps: ['โปรแกรมอ่าน PDF'], appVersion: 'Adobe Acrobat Reader หรือแอปดู PDF ในมือถือ (ฟรี)', formats: ['PDF'], count: '40 หน้า', size: 'A4 300 dpi', files: [JSON.stringify({ name: 'coloring-40p.pdf', size: '22 MB', scan: 'ok' })], editable: ['ไม่ต้องแก้ พิมพ์ได้ทันที'], howOpen: ['ดาวน์โหลด PDF จากคลังของที่ซื้อ', 'สั่งพิมพ์ขนาด A4 แบบ “พอดีหน้า”'] }
        : { noPro: true, count: '30 แบบ', size: '1080×1350 px (IG 4:5)', canvaLink: 'canva.com/design/DAF-sample/remix', files: [JSON.stringify({ name: 'cafe-30.psd', size: '86 MB', scan: 'ok' })], formats: ['ลิงก์ Canva', 'PSD', 'PDF'], apps: ['Canva', 'Photoshop'], appVersion: 'Canva ฟรี · Photoshop 2023 ขึ้นไป' })
    d.fonts = print ? [] : ['Prompt — fonts.google.com/specimen/Prompt', 'Mali — fonts.google.com/specimen/Mali']
  }
  if (t === 'sw' || t === 'game') Object.assign(d, { sub: /แอป/.test(l) ? 'แอปมือถือ' : /เกม/.test(l) ? 'ซอร์สโค้ดเกม' : /ปลั๊กอิน/.test(l) ? 'ปลั๊กอิน' : /ส่วนขยาย/.test(l) ? 'ส่วนขยาย Chrome' : 'โปรแกรม', platforms: p.platforms ?? ['Windows'], version: 'v1.3', changelog: ['v1.3 · เร็วขึ้น 2 เท่า แก้บั๊กภาษาไทย', 'v1.2 · เพิ่มรายงานรายวัน', 'v1.0 · เปิดตัว'], minSpec: /iOS|Android/.test((p.platforms ?? []).join()) ? 'iOS 15 / Android 10 ขึ้นไป' : 'RAM 4 GB · พื้นที่ว่าง 200 MB', files: [JSON.stringify({ name: `${slug}-v1.3.zip`, size: '48 MB', scan: 'ok' })] })
  if (t === 'game' && /เกม/.test(l)) Object.assign(d, { platforms: ['เว็บ', 'Android'], deps: 'Godot 4.2 (ฟรี) ถ้าจะแก้ซอร์ส', install: ['แตกไฟล์ ZIP', 'เปิดโปรเจกต์ด้วย Godot 4.2', 'กด Run เพื่อเล่น หรือ Export เป็น APK'] })
  if (t === 'sw' && p.kind === 'tool' && !/โปรแกรม|แอป/.test(l)) Object.assign(d, { sub: 'เว็บแอป', platforms: ['เว็บ'], keyType: 'สมาชิกรายเดือน', minSpec: 'เบราว์เซอร์ Chrome / Safari รุ่นล่าสุด', install: ['ไม่ต้องติดตั้ง เปิดลิงก์ในคลังของที่ซื้อ', 'ล็อกอินด้วยอีเมลที่ใช้ซื้อ'], deps: `บัญชี ${(p.platforms ?? []).join(' / ')}` })
  if (t === 'bot') {
    const demo = p.id === 'p05' ? ['มีเมนูแนะนำไหมคะ', 'วันนี้แนะนำข้าวเหนียวมะม่วง ฿89 สั่งเลยไหมคะ 🥭', 'เอา 2 ที่ค่ะ', 'รับออเดอร์แล้วค่ะ ยอดรวม ฿178 ชำระผ่าน QR ได้เลย']
      : p.chat ? [p.chat.q, p.chat.a]
      : /แอดมิน/.test(p.title) ? ['ลูกค้าถาม: ส่งต่างจังหวัดกี่วันคะ', 'ร่างคำตอบ: ส่งขนส่งเอกชน 1–2 วันทำการค่ะ สั่งก่อนบ่าย 2 ส่งวันนี้เลย 🙏']
      : /สต็อก/.test(p.title) ? ['สต็อก: ชาไทยผง เหลือ 3 ถุง', '⚠️ ของใกล้หมด ชาไทยผงเหลือ 3 ถุง (ต่ำกว่า 5) · แจ้งในกลุ่ม LINE ร้านแล้ว']
      : /ออเดอร์/.test(p.title) ? ['ขอสั่งชาไทย 2 แก้ว ส่งบ้านค่ะ', 'บันทึกออเดอร์ #1024 ลง Google Sheets แล้ว ✓ แจ้งร้านใน LINE แล้ว']
      : []
    const line = (p.platforms ?? ['LINE OA']).some((x) => /LINE/.test(x))
    Object.assign(d, { demo, trialLink: line ? 'line.me/R/ti/p/@lumi-demo' : 'chatgpt.com/g/lumi-demo', sub: /ผู้ช่วย/.test(l) ? 'ผู้ช่วย AI' : /อัตโนมัติ/.test(l) ? 'ระบบอัตโนมัติ' : 'บอทแชต' })
  }
  if (t === 'bot' && /แอดมิน/.test(p.title)) Object.assign(d, { features: [p.use, 'ร่างคำตอบลูกค้าด้วยโทนสุภาพแบบไทย', 'สรุปแชตทั้งวันเป็นข้อ ๆ ให้แอดมิน'], buyerNeeds: ['ChatGPT Plus (ใช้ GPTs ได้)', 'เพจ Facebook ที่คุณเป็นแอดมิน'], limits: 'ใช้ได้ตามโควตาข้อความของ ChatGPT Plus' })
  if (t === 'bot') Object.assign(d, { platform: p.platforms ?? ['LINE OA'], features: p.kind === 'bot' ? [p.use, 'ตอบลูกค้าอัตโนมัติ 24 ชม.', 'ส่งออเดอร์เข้า Google Sheets', 'แจ้งเตือนเจ้าของร้านใน LINE'] : [p.use, 'ตั้งเวลาทำงานเองทุกวัน', 'ดูรายงานย้อนหลังได้'], buyerNeeds: p.kind === 'bot' ? ['บัญชี LINE OA (สมัครฟรี)', 'เมนูและราคา (ไฟล์หรือรูปก็ได้)'] : [`บัญชี ${(p.platforms ?? ['Google']).join(' · ')}`, 'บัญชี n8n Cloud หรือเครื่องที่ติดตั้ง n8n (ฟรี)'], limits: p.kind === 'bot' ? 'ตอบได้ตามโควตาข้อความของ LINE OA (แพ็กเกจฟรี 300 ข้อความ/เดือน)' : 'ทำงานได้ 2,500 ครั้ง/เดือน ตามแพ็กเกจ n8n Starter', trialLink: d.trialLink })
  if (t === 'course') Object.assign(d, { lessons: ['ตอนที่ 1 · ปูพื้นและเครื่องมือที่ต้องใช้ · 09:30', 'ตอนที่ 2 · เขียนพรอมต์ให้ได้ภาพตรงใจ · 14:20', 'ตอนที่ 3 · จัดแสงแบบสตูดิโอ · 18:05', 'ตอนที่ 4 · แต่งพื้นหลังโทนพาสเทล · 12:40', 'ตอนที่ 5 · ทำภาพชุดลง Shopee · 16:10', 'ตอนที่ 6 · เวิร์กช็อปปิดคอร์ส · 22:00'], duration: '1 ชม. 33 นาที', prereq: 'มีมือถือหรือคอม ไม่ต้องมีพื้นฐาน', outcomes: ['ทำภาพสินค้าสวยได้เองในวันเดียว', 'มีพรอมต์สำเร็จรูปไว้ใช้ต่อ', 'รู้วิธีทำภาพชุดลงร้านออนไลน์'], materials: ['สรุป PDF', 'พรอมต์สำเร็จรูป'] })
  if (t === 'course') d.files = arr(d.lessons).map((_, i) => JSON.stringify({ name: `lesson-${String(i + 1).padStart(2, '0')}.mp4`, size: `${120 + i * 37} MB`, scan: 'ok' }))
  if (t === 'course' && /อีบุ๊ก/.test(l)) Object.assign(d, { sub: 'อีบุ๊ก', files: [JSON.stringify({ name: 'prompt-ebook-30.pdf', size: '4.8 MB', scan: 'ok' }), JSON.stringify({ name: 'prompt-ebook-30.epub', size: '1.2 MB', scan: 'ok' })], lessons: ['บทที่ 1 · พรอมต์เขียนแคปชันขาย', 'บทที่ 2 · พรอมต์ตอบแชตลูกค้า', 'บทที่ 3 · พรอมต์ทำโปรโมชัน'], duration: p.meta ?? '24 หน้า', materials: ['สรุป PDF', 'พรอมต์สำเร็จรูป'], certificate: false })
  if (t === 'font') {
    const sticker = /สติกเกอร์/.test(l)
    Object.assign(d, sticker ? { sub: 'สติกเกอร์ PNG', formats: ['PNG'], count: /(\d+) (ตัว|อารมณ์)/.exec(p.title)?.[0] ?? '8 ตัว', compat: 'LINE (ส่งเป็นรูป) · LINE Creators Market', install: ['ดาวน์โหลดไฟล์ PNG พื้นใสจากคลังของที่ซื้อ', 'บันทึกลงอัลบั้มมือถือ', 'ส่งในแชตเป็นรูป หรืออัปขึ้น LINE Creators Market'], files: [JSON.stringify({ name: `${slug}-stickers.zip`, size: '3.2 MB', scan: 'ok' })] }
      : { count: '3 น้ำหนัก (ปกติ หนา บาง)', files: [JSON.stringify({ name: `${slug}-Regular.otf`, size: '420 KB', scan: 'ok' }), JSON.stringify({ name: `${slug}-Bold.otf`, size: '436 KB', scan: 'ok' })] })
  }
  if (t === 'media') {
    const music = /เพลง/.test(l), tplv = /เทมเพลต/.test(l)
    Object.assign(d, music ? { sub: 'เพลงต้นฉบับ', count: '10 เพลง', duration: 'รวม 32 นาที (เพลงละ 2–4 นาที)', formats: ['WAV', 'MP3'], quality: 'WAV 48kHz 24-bit', aiTool: 'Suno', musicLic: 'ผู้ขายรับรองว่าใช้ในคลิปโซเชียลได้', files: [JSON.stringify({ name: 'lukthung-chill-10.zip', size: '410 MB', scan: 'ok' })], howUse: ['ดาวน์โหลด ZIP จากคลังของที่ซื้อ แล้วแตกไฟล์', 'ลากเพลงเข้า CapCut / Premiere เป็นแทร็กเสียง', 'ใส่เครดิต “Music by Ton Sheets” ในคำบรรยาย (ไม่บังคับ)'] }
      : tplv ? { sub: 'เทมเพลตตัดต่อวิดีโอ', count: '5 แบบ', duration: 'แบบละ 12–20 วินาที', formats: ['เทมเพลต CapCut'], quality: '9:16 1080×1920', appVersion: 'CapCut มือถือ 12.0 ขึ้นไป (ฟรี)', aiTool: 'CapCut AI', files: [JSON.stringify({ name: 'skincare-capcut-links.pdf', size: '180 KB', scan: 'ok' })], howUse: ['เปิดลิงก์เทมเพลตในไฟล์ PDF ด้วยมือถือ', 'กด “ใช้เทมเพลต” ใน CapCut', 'เลือกคลิปสินค้าของคุณ 3–5 คลิป แล้วกดส่งออก'] }
        : { sub: 'วิดีโอ AI', count: '1 คลิป + เวอร์ชันไม่มีข้อความ', duration: '15 วินาที', formats: ['MP4', 'SRT (ซับไตเติล)'], quality: '9:16 1080×1920', aiTool: 'Kling', files: [JSON.stringify({ name: 'cafe-promo-15s.mp4', size: '38 MB', scan: 'ok' }), JSON.stringify({ name: 'cafe-promo-clean.mp4', size: '36 MB', scan: 'ok' })], howUse: ['ดาวน์โหลด MP4 จากคลังของที่ซื้อ', 'โพสต์ลง Reels / TikTok ได้ทันที หรือเปลี่ยนข้อความใน CapCut', 'ใช้ไฟล์ SRT ถ้าอยากแก้คำบรรยาย'] })
    d.noClone = true
    if (str(d.aiTool) && str(d.aiTool) !== 'ไม่ได้ใช้ AI') d.aiPlan = 'แผนเสียเงิน (ใช้เชิงพาณิชย์ได้)'
  }
  if (t === 'skill') Object.assign(d, /ภาษี/.test(p.title)
    ? { platforms: ['ChatGPT (GPTs / Projects)', 'Claude (Agent Skills)'], contents: ['SKILL.md — วิธีตอบคำถามภาษีร้านค้า', 'tax-th-2569.md — สรุปเกณฑ์ VAT และภาษีเงินได้', 'examples.md — ตัวอย่างคำถาม-คำตอบ 40 ข้อ'], version: 'v2.1', changelog: ['v2.1 · อัปเดตเกณฑ์ปี 2569', 'v2.0 · เพิ่มเรื่องใบกำกับภาษีอิเล็กทรอนิกส์'], features: ['ตอบเรื่องจด VAT เมื่อรายได้เกิน 1.8 ล้าน', 'คำนวณภาษีเงินได้คร่าว ๆ จากยอดขาย', 'บอกเอกสารที่ต้องเก็บ', 'ข้อมูลทั่วไป ไม่ใช่คำปรึกษาจากผู้เชี่ยวชาญ ควรตรวจกับนักบัญชีหรือกรมสรรพากรก่อนใช้จริง'], buyerNeeds: ['ChatGPT Plus หรือ Claude Pro ขึ้นไป'], examples: ['ขายของออนไลน์ปีละ 2 ล้าน ต้องจด VAT ไหม'], files: [JSON.stringify({ name: 'tax-skill-v2.1.zip', size: '140 KB', scan: 'ok' })] }
    : { contents: ['SKILL.md — โทนการตอบ กฎของร้าน', 'faq.md — คำถามที่พบบ่อย (แก้เป็นของร้านคุณได้)', 'scripts/price.py — คำนวณค่าส่ง'], version: 'v1.2', changelog: ['v1.2 · รองรับ Cursor', 'v1.0 · เปิดตัว'], features: ['ตอบลูกค้าด้วยโทนสุภาพแบบไทย', 'คำนวณค่าส่งตามน้ำหนัก', 'ส่งต่อให้แอดมินเมื่อเจอคำถามยาก'], buyerNeeds: ['Claude Pro ขึ้นไป หรือ Cursor (ฟรีได้)'], examples: ['ลูกค้าถามค่าส่งไปเชียงใหม่ 2 กก. ตอบให้หน่อย'], platforms: ['Claude (Agent Skills)', 'Cursor (Rules / Skills)'], files: [JSON.stringify({ name: 'shop-chat-skill-v1.2.zip', size: '96 KB', scan: 'ok' })] })
  if (t === 'data') Object.assign(d, /เมนู/.test(p.title)
    ? { formats: ['CSV', 'JSON'], size: '5,000 แถว · 12 คอลัมน์ · 3.2 MB', columns: ['name — ชื่อเมนู (ข้อความ)', 'name_en — ชื่ออังกฤษ', 'category — หมวด เช่น ต้ม ผัด แกง', 'kcal — แคลอรี่โดยประมาณ (ตัวเลข)', 'spicy — ระดับเผ็ด 0–3', 'price_avg — ราคาเฉลี่ย (บาท)'], source: 'รวบรวมเองจากเมนูร้านที่ได้รับอนุญาต 120 ร้าน และสูตรที่เผยแพร่สาธารณะ ระหว่าง ม.ค.–ก.ย. 2569', useCases: ['ทำแอปสั่งอาหาร / แนะนำเมนู', 'เทรนหรือทดสอบโมเดลภาษาไทย', 'วิเคราะห์ราคาอาหาร'], updates: 'อัปเดตรายไตรมาส', files: [JSON.stringify({ name: 'thai-menu-5000.csv', size: '3.2 MB', scan: 'ok' }), JSON.stringify({ name: 'thai-menu-5000.json', size: '4.1 MB', scan: 'ok' })] }
    : { formats: ['JSONL', 'CSV'], size: '12,000 แถว · 4 คอลัมน์ · 2.6 MB', columns: ['text — ข้อความรีวิว (ตัดชื่อคนออกแล้ว)', 'label — บวก / กลาง / ลบ', 'category — หมวดสินค้า', 'stars — คะแนน 1–5'], source: 'ผู้ขายบน LUMI ยินยอมให้ใช้รีวิวร้านตัวเอง ตัดข้อมูลส่วนตัวด้วยสคริปต์และตรวจด้วยคน', useCases: ['วิเคราะห์ความรู้สึก (sentiment)', 'ทดสอบบอทตอบรีวิว'], files: [JSON.stringify({ name: 'th-reviews-12k.jsonl', size: '2.6 MB', scan: 'ok' })] })
  if (t === 'data') Object.assign(d, { rights: true, noPII: true })
  if (t === 'hire') Object.assign(d, { deliverables: [p.title.replace(/^จ้าง/, ''), 'ไฟล์ PNG พื้นใส ความละเอียดสูง', 'ไฟล์ต้นฉบับสำหรับแก้ต่อ'], revisions: `${p.revisions ?? 3} ครั้ง`, timeline: (p.days ?? 5) <= 3 ? '1–3 วัน' : '3–7 วัน' })
  return d
}

export interface PageContent { deliver: string[]; howto: string[]; needs: string[]; facts: [string, string][]; refund?: string; support?: string; lic?: string[] }

/** Builds the buyer-facing sections from a spec. */
export function pageContent(p: Product): PageContent {
  const t = sellTypeOf(p)
  const s = specOf(p)
  const files = filesOf(s.files).map((f) => f.name)
  const fm = arr(s.formats)
  const deliver: string[] = []
  const howto: string[] = []
  const needs: string[] = []
  const facts: [string, string][] = []
  const lic = arr(s.licAllowed)
  switch (t) {
    case 'img':
      deliver.push(`ไฟล์ภาพ ${str(s.count)} · ${str(s.resolution)} · ${list(fm)}`)
      if (files.length) deliver.push(`ไฟล์: ${files.join(', ')}`)
      if (on(s.sellPrompt)) deliver.push('พรอมต์ฉบับเต็ม (ปลดล็อกหลังซื้อ)', `โมเดล ${str(s.model)} + ค่าตั้ง ${str(s.settings)}`)
      deliver.push('ตารางสิทธิ์การใช้งาน (ดูได้ในคลัง)')
      howto.push('ดาวน์โหลดไฟล์จากคลังของที่ซื้อ', 'เปิดด้วยแอปดูรูป Canva หรือ Photoshop ได้ทันที')
      if (on(s.sellPrompt)) howto.push(`คัดลอกพรอมต์ไปวางใน ${str(s.model)} แล้วใส่ค่าตั้ง ${str(s.settings)} เพื่อสร้างภาพแนวเดียวกัน`)
      needs.push('ไม่ต้องติดตั้งอะไรเพิ่ม')
      if (on(s.sellPrompt)) needs.push(`บัญชี ${str(s.model)} (ถ้าอยากสร้างภาพเอง)`)
      facts.push(['ความละเอียด', str(s.resolution)], ['สัดส่วน', str(s.aspect)], ['ไฟล์', list(fm)])
      if (on(s.sellPrompt)) facts.push(['โมเดล', str(s.model)])
      break
    case 'tpl':
      deliver.push(`${str(s.count)} · ขนาด ${str(s.size)}`, `ไฟล์ ${list(fm)}`)
      if (files.length) deliver.push(`ไฟล์: ${files.join(', ')}`)
      if (arr(s.apps).includes('Canva')) deliver.push('ลิงก์ Canva แบบ “ใช้เป็นเทมเพลต” (อยู่ในคลังของที่ซื้อหลังจ่าย)')
      if (arr(s.fonts).length) deliver.push('รายชื่อฟอนต์พร้อมลิงก์โหลดฟรี', 'คู่มือแก้ไขทีละขั้น')
      else deliver.push(fm.length === 1 && fm[0] === 'PDF' ? 'คู่มือสั่งพิมพ์ให้สีตรง' : 'คู่มือแก้ไขทีละขั้น')
      howto.push(...arr(s.howOpen))
      needs.push(`แอป: ${arr(s.apps).join(' / ')} (${str(s.appVersion)})`, ...arr(s.fonts).map((f) => `ฟอนต์ ${f}`))
      facts.push(['แก้ได้', list(arr(s.editable))], ['ขนาด', str(s.size)], ['ไฟล์', list(fm)])
      break
    case 'sw': case 'game':
      if (str(s.sub) === 'เว็บแอป') deliver.push('ลิงก์เข้าใช้งานเว็บแอป อยู่ในคลังของที่ซื้อทันทีหลังจ่าย (ไม่ต้องติดตั้ง)')
      else deliver.push(`ไฟล์ติดตั้ง ${files.join(', ') || '-'} (สแกนไวรัสเบื้องต้นแล้ว)`)
      if (str(s.storeLink)) deliver.push('ลิงก์ติดตั้งจากร้านค้าแอป (App Store / Google Play / Chrome Web Store / TestFlight)')
      if (str(s.keyType) !== 'ไม่ต้องใช้คีย์') deliver.push(`คีย์ใช้งานแบบ${str(s.keyType)} อยู่ในคลังของที่ซื้อทันทีหลังจ่าย`)
      deliver.push(`เวอร์ชัน ${str(s.version)} พร้อมประวัติอัปเดต`, str(s.support), 'คู่มือติดตั้งและเปิดใช้งาน')
      howto.push(...arr(s.install), ...(str(s.keyType) !== 'ไม่ต้องใช้คีย์' ? arr(s.activation) : []))
      needs.push(`รองรับ ${list(arr(s.platforms))}`, `สเปกขั้นต่ำ ${str(s.minSpec)}`, `ต้องมี: ${str(s.deps)}`)
      facts.push(['ประเภท', str(s.sub)], ['เวอร์ชัน', str(s.version)], ['คีย์', str(s.keyType)], ['ทดลองใช้', on(s.trial) ? str(s.trialDays) : 'ไม่มี'])
      break
    case 'bot':
      deliver.push(`บอทพร้อมใช้บน ${list(arr(s.platform))}`, ...arr(s.features).slice(0, 3).map((f) => `ทำได้: ${f}`), `การติดตั้ง: ${str(s.setupMode)}`)
      if (on(s.trial)) deliver.push(`ทดลองฟรี ${str(s.trialDays)}`)
      howto.push(...arr(s.setup))
      needs.push(...arr(s.buyerNeeds), `ข้อจำกัด: ${str(s.limits)}`)
      facts.push(['ประเภท', str(s.sub)], ['แพลตฟอร์ม', list(arr(s.platform))], ['ติดตั้ง', str(s.setupMode)], ['ทดลอง', on(s.trial) ? str(s.trialDays) : 'ไม่มี'])
      break
    case 'course': {
      const eb = isEbook(s, p.label), n = arr(s.lessons).length
      const forever = str(s.access) === 'ไม่จำกัดเวลา' || str(s.access) === 'ตลอดชีพ'
      deliver.push(eb ? `อีบุ๊ก ${n} บท · ${str(s.duration)}` : `วิดีโอ ${n} ตอน · รวม ${str(s.duration)}`)
      if (files.length) deliver.push(`ไฟล์: ${files.slice(0, 4).join(', ')}${files.length > 4 ? ` และอีก ${files.length - 4} ไฟล์` : ''}`)
      deliver.push(...arr(s.materials).map((m) => `ไฟล์ประกอบ: ${m}`))
      if (!eb) deliver.push(forever ? 'ดูได้ไม่จำกัดเวลา ตราบที่คอร์สยังเปิดบน LUMI · ถ้าจะปิด จะแจ้งล่วงหน้า' : `ดูได้ ${str(s.access)}`)
      if (!eb && on(s.certificate)) deliver.push('ใบรับรองเมื่อเรียนจบ')
      if (eb) howto.push('ซื้อแล้วไปที่ คลังของที่ซื้อ › ดาวน์โหลด', 'เปิดด้วยแอปอ่าน PDF หรือ EPUB ในมือถือหรือคอม', 'แนะนำให้ดาวน์โหลดเก็บไว้ · สงสัยตรงไหนถามผู้เขียนในแชต')
      else howto.push('ซื้อแล้วไปที่ คลังของที่ซื้อ › ห้องเรียน', 'ดูต่อจากตอนล่าสุดได้ทุกเครื่อง', 'ติดตรงไหนถามผู้สอนในแชต แนบเลขตอนและนาทีได้')
      needs.push(str(s.prereq), eb ? 'แอปอ่าน PDF หรือ EPUB (ฟรี)' : 'เรียนผ่านแอป LUMI หรือเว็บเบราว์เซอร์')
      facts.push(['รูปแบบ', eb ? 'อีบุ๊ก' : 'คอร์สวิดีโอ'], ['ระดับ', str(s.level)], ['ความยาว', str(s.duration)], [eb ? 'อ่านฟรี' : 'ดูฟรี', str(s.freeLessons)])
      if (!eb) facts.push(['เข้าถึง', forever ? 'ไม่จำกัดเวลา' : str(s.access)])
      break
    }
    case 'font':
      deliver.push(`${str(s.count)} · ไฟล์ ${list(fm)}`)
      if (files.length) deliver.push(`ไฟล์: ${files.join(', ')}`)
      if (arr(s.languages).length) deliver.push(`รองรับ ${list(arr(s.languages))}`)
      deliver.push('ตารางสิทธิ์การใช้งาน (ดูได้ในคลัง)')
      howto.push(...arr(s.install))
      needs.push(`ใช้กับ ${str(s.compat)}`)
      facts.push(['ประเภท', str(s.sub)], ['ไฟล์', list(fm)], ['จำนวน', str(s.count)])
      break
    case 'media':
      deliver.push(`${str(s.count)} · ${str(s.duration)}`, `ไฟล์ ${list(fm)} · ${str(s.quality)}`)
      if (files.length) deliver.push(`ไฟล์: ${files.join(', ')}`)
      deliver.push(`สิทธิ์: ${str(s.musicLic)}`, 'ไม่มีลายน้ำ LUMI · สแกนไวรัสเบื้องต้นแล้ว', 'หากถูกระบบแพลตฟอร์มแจ้งลิขสิทธิ์ ติดต่อครีเอเตอร์หรือขอคืนเงินได้')
      howto.push(...arr(s.howUse))
      needs.push(str(s.appVersion) || 'แอปเล่นวิดีโอ/เสียง หรือแอปตัดต่อใดก็ได้')
      facts.push(['ประเภท', str(s.sub)], ['ความยาว', str(s.duration)], ['คุณภาพ', str(s.quality)], ['สร้างด้วย', str(s.aiTool)], ['เสียง/หน้าคนจริง', on(s.noClone) ? 'ผู้ขายรับรองว่าไม่ได้โคลน' : '-'])
      break
    case 'skill':
      deliver.push(...arr(s.contents), `เวอร์ชัน ${str(s.version)}`, str(s.support))
      howto.push(...arr(s.install), ...arr(s.examples).map((e) => `ลองสั่ง: “${e}”`))
      needs.push(`ใช้กับ ${list(arr(s.platforms))}`, ...arr(s.buyerNeeds))
      facts.push(['ใช้กับ', list(arr(s.platforms))], ['เวอร์ชัน', str(s.version)], ['ไฟล์ในชุด', `${arr(s.contents).length} ไฟล์`])
      break
    case 'data':
      deliver.push(`${str(s.size)}`, `ไฟล์ ${list(fm)}`, ...files.map((f) => `ไฟล์: ${f}`), `คำอธิบายคอลัมน์ ${arr(s.columns).length} รายการ (data dictionary)`, `การอัปเดต: ${str(s.updates)}`)
      howto.push('ดาวน์โหลดไฟล์จากคลังของที่ซื้อ', `เปิดด้วย Excel / Google Sheets (CSV) หรือโค้ด เช่น pandas.read_csv()`, ...arr(s.useCases).map((u) => `ใช้ได้กับ: ${u}`))
      needs.push('โปรแกรมเปิดไฟล์ตาราง หรือภาษาโปรแกรมที่อ่าน CSV/JSON ได้')
      facts.push(['ขนาด', str(s.size)], ['รูปแบบ', list(fm)], ['อัปเดต', str(s.updates)], ['ข้อมูลส่วนบุคคล', on(s.noPII) ? 'ผู้ขายรับรองว่าไม่มี' : '-'], ['สิทธิ์เผยแพร่', on(s.rights) ? 'ผู้ขายรับรองแล้ว' : '-'])
      break
    case 'hire':
      deliver.push(...arr(s.deliverables), `ไฟล์ ${list(fm)}`, `แก้ไขได้ ${str(s.revisions)}`, `ส่งงานภายใน ${str(s.timeline)}`, `สิทธิ์: ${str(s.rights)}`, str(s.copyright) ? `ลิขสิทธิ์: ${str(s.copyright)}${/^โอน/.test(str(s.copyright)) ? ' · งานที่สร้างด้วย AI อาจได้รับความคุ้มครองลิขสิทธิ์ไม่เต็มที่' : ''}` : '')
      howto.push('ส่งบรีฟในแชต (มีแบบฟอร์มให้)', 'ครีเอเตอร์ส่งใบเสนอราคา คุณกดรับ', 'ชำระผ่านผู้ให้บริการชำระเงิน · ยังไม่โอนให้ครีเอเตอร์จนกว่าคุณกดรับงาน', 'ครีเอเตอร์อัปเดตความคืบหน้าและส่งงาน', 'ตรวจงาน ขอแก้ หรือกดรับงาน · ถ้าไม่ขอแก้หรือแจ้งปัญหาภายใน 3 วันหลังส่งงาน ระบบโอนเงินให้ครีเอเตอร์อัตโนมัติ')
      needs.push(...arr(s.briefNeeds))
      facts.push(['ส่งงาน', str(s.timeline)], ['แก้ไข', str(s.revisions)], ['สิทธิ์', str(s.rights)])
      break
  }
  if (t === 'media' && str(s.aiTool) && str(s.aiTool) !== 'ไม่ได้ใช้ AI') facts.push(['แผนเครื่องมือ AI', str(s.aiPlan) || '-'])
  if (t !== 'media' && str(s.aiUse)) facts.push(['ใช้ AI', str(s.aiUse) === 'ไม่ได้ใช้ AI' ? 'ไม่ได้ใช้ AI' : `${str(s.aiUse)}${str(s.aiTools) ? ` · ${str(s.aiTools)}` : ''}`])
  return { deliver: deliver.filter(Boolean), howto, needs: needs.filter(Boolean), facts: facts.filter(([, v]) => !!v), refund: str(s.refund) || undefined, support: str(s.support) || undefined, lic: t === 'hire' ? undefined : lic }
}
