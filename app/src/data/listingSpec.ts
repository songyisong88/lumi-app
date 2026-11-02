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

export const LIC_ROWS = ['งานส่วนตัว การบ้าน', 'โพสต์ขายของ โฆษณา', 'โลโก้ ป้ายร้าน', 'สินค้าที่พิมพ์ขาย', 'ขายต่อหรือแจกต่อไฟล์']
export const LIC_PRESETS: Record<string, string[]> = {
  'ส่วนตัว + เชิงพาณิชย์': LIC_ROWS.slice(0, 4),
  'ส่วนตัวอย่างเดียว': LIC_ROWS.slice(0, 1),
  'กำหนดเอง': [],
}

// Fields every type shares on the license step.
const LICENSE: Field[] = [
  { id: 'licPreset', label: 'แบบสิทธิ์การใช้งาน', kind: 'chips', step: 'license', options: Object.keys(LIC_PRESETS), required: true },
  { id: 'licAllowed', label: 'ผู้ซื้อทำอะไรได้บ้าง', kind: 'multi', step: 'license', options: LIC_ROWS, required: true, hint: 'ตารางนี้โชว์บนหน้าสินค้า' },
]
const REFUND: Field = { id: 'refund', label: 'เงื่อนไขคืนเงิน', kind: 'text', step: 'license', required: true, placeholder: 'เช่น คืนเงินได้ภายใน 7 วัน ถ้าติดตั้งไม่ได้' }
const SUPPORT: Field = { id: 'support', label: 'ซัพพอร์ตและอัปเดต', kind: 'text', step: 'license', required: true, placeholder: 'เช่น อัปเดตฟรี 1 ปี · ตอบแชตภายใน 24 ชม.' }
const FILES = (label: string, hint: string, req: boolean | ((s: Spec) => boolean) = true): Field => ({ id: 'files', label, kind: 'files', step: 'files', hint, required: req })

export const SPECS: Record<SellType, TypeSpec> = {
  img: {
    key: 'img', name: 'ภาพ + พรอมต์', sub: 'ภาพ ชุดภาพ หรือพรอมต์', icon: 'image', color: '#6C2BD9', bg: '#F3ECFF', layout: 'img',
    fields: [
      FILES('ไฟล์ภาพที่ผู้ซื้อได้รับ', 'ไฟล์ต้นฉบับ ไม่มีลายน้ำ'),
      { id: 'count', label: 'จำนวนภาพในชุด', kind: 'text', step: 'files', required: true, placeholder: 'เช่น 1 ภาพ หรือ 8 ภาพ 8 มุม' },
      { id: 'resolution', label: 'ความละเอียด', kind: 'chips', step: 'files', options: ['4K (3840 px ขึ้นไป)', '2K (2048 px)', 'Full HD (1920 px)', 'A4 300 dpi'], required: true },
      { id: 'formats', label: 'นามสกุลไฟล์', kind: 'multi', step: 'files', options: ['PNG', 'JPG', 'WEBP', 'PSD', 'SVG'], required: true },
      { id: 'aspect', label: 'สัดส่วนภาพ', kind: 'chips', step: 'details', options: ['1:1', '3:4', '4:5', '9:16', '16:9'], required: true },
      { id: 'sellPrompt', label: 'ขายพรอมต์ด้วย', kind: 'toggle', step: 'price', hint: 'ผู้ซื้อเห็นพรอมต์ฉบับเต็มหลังจ่าย' },
      { id: 'prompt', label: 'พรอมต์ฉบับเต็ม', kind: 'textarea', step: 'price', when: (s) => on(s.sellPrompt), required: (s) => on(s.sellPrompt), placeholder: '/imagine prompt: …' },
      { id: 'model', label: 'โมเดลที่ใช้', kind: 'chips', step: 'price', options: ['Midjourney v7', 'DALL·E 3', 'Stable Diffusion XL', 'Flux', 'Adobe Firefly', 'อื่น ๆ'], when: (s) => on(s.sellPrompt), required: (s) => on(s.sellPrompt) },
      { id: 'settings', label: 'ค่าตั้งที่ใช้ (seed / stylize / ar)', kind: 'text', step: 'price', when: (s) => on(s.sellPrompt), required: (s) => on(s.sellPrompt), placeholder: 'เช่น --ar 3:4 --stylize 650 --seed 1234' },
      ...LICENSE,
    ],
    defaults: { resolution: '4K (3840 px ขึ้นไป)', formats: ['PNG'], aspect: '3:4', count: '1 ภาพ', sellPrompt: true, licPreset: 'ส่วนตัว + เชิงพาณิชย์', licAllowed: LIC_PRESETS['ส่วนตัว + เชิงพาณิชย์'] },
  },
  tpl: {
    key: 'tpl', name: 'เทมเพลต', sub: 'Canva PSD สไลด์ โพสต์', icon: 'megaphone', color: '#2563EB', bg: '#EAF1FF', layout: 'tpl',
    fields: [
      { id: 'apps', label: 'ต้องเปิดด้วยแอปอะไร', kind: 'multi', step: 'files', options: ['Canva', 'Photoshop', 'Illustrator', 'Figma', 'PowerPoint', 'Google Slides', 'Keynote', 'Excel / Sheets', 'เว็บ (HTML)'], required: true },
      { id: 'appVersion', label: 'เวอร์ชันแอปที่ต้องใช้', kind: 'text', step: 'files', required: true, placeholder: 'เช่น Canva ฟรี · Photoshop 2023 ขึ้นไป' },
      { id: 'canvaLink', label: 'ลิงก์ Canva แบบ “ใช้เป็นเทมเพลต”', kind: 'text', step: 'files', when: (s) => arr(s.apps).includes('Canva'), required: (s) => arr(s.apps).includes('Canva'), placeholder: 'canva.com/design/…/remix', hint: 'ส่งให้ผู้ซื้อหลังจ่ายเท่านั้น' },
      FILES('ไฟล์เทมเพลต', 'PSD AI FIG PPTX ฯลฯ', (s) => arr(s.apps).some((a) => a !== 'Canva')),
      { id: 'formats', label: 'ไฟล์ที่ผู้ซื้อได้รับ', kind: 'multi', step: 'files', options: ['ลิงก์ Canva', 'PSD', 'AI', 'FIG', 'PPTX', 'KEY', 'XLSX', 'HTML', 'PDF'], required: true },
      { id: 'count', label: 'จำนวนแบบ / หน้า', kind: 'text', step: 'files', required: true, placeholder: 'เช่น 30 แบบ' },
      { id: 'size', label: 'ขนาดชิ้นงาน', kind: 'text', step: 'files', required: true, placeholder: 'เช่น 1080×1350 px (IG 4:5)' },
      { id: 'fonts', label: 'ฟอนต์ที่ใช้ + ลิงก์โหลดฟรี', kind: 'list', step: 'details', required: true, placeholder: 'เช่น Prompt — fonts.google.com/specimen/Prompt', hint: 'ถ้าไม่ใส่ ผู้ซื้อเปิดแล้วฟอนต์เพี้ยน' },
      { id: 'editable', label: 'แก้อะไรได้บ้าง', kind: 'multi', step: 'details', options: ['ข้อความ', 'สี', 'รูปภาพ', 'โลโก้', 'ฟอนต์', 'ขนาด / เลย์เอาต์'], required: true },
      { id: 'howOpen', label: 'วิธีเปิดและแก้ไข (ทีละขั้น)', kind: 'list', step: 'details', required: true },
      ...LICENSE,
    ],
    defaults: { apps: ['Canva'], appVersion: 'Canva ฟรี (ไม่ต้องใช้ Pro)', formats: ['ลิงก์ Canva', 'PDF'], editable: ['ข้อความ', 'สี', 'รูปภาพ', 'โลโก้'], howOpen: ['เปิดลิงก์ Canva ที่ได้ในแชต', 'กด “ใช้เทมเพลต” ระบบจะคัดลอกเข้าบัญชีคุณ', 'แก้ข้อความ สี และรูป แล้วกดแชร์ › ดาวน์โหลด'], licPreset: 'ส่วนตัว + เชิงพาณิชย์', licAllowed: LIC_PRESETS['ส่วนตัว + เชิงพาณิชย์'] },
  },
  sw: {
    key: 'sw', name: 'โปรแกรม · แอป', sub: 'ไฟล์ติดตั้ง คีย์ใช้งาน', icon: 'code', color: '#4F46E5', bg: '#EEF2FF', layout: 'sw',
    fields: [
      { id: 'sub', label: 'เป็นแบบไหน', kind: 'chips', step: 'files', options: ['โปรแกรม', 'แอปมือถือ', 'เว็บแอป'], required: true },
      FILES('ไฟล์ติดตั้ง', '.exe .dmg .apk .zip · LUMI สแกนไวรัสทุกไฟล์ ไฟล์ไม่ผ่านลงขายไม่ได้'),
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
      SUPPORT, REFUND, ...LICENSE,
    ],
    defaults: { sub: 'โปรแกรม', platforms: ['Windows'], keyType: 'คีย์ต่อเครื่อง', deps: 'ไม่ต้องติดตั้งเพิ่ม', install: ['ดาวน์โหลดไฟล์ติดตั้งจากแชต (สแกนไวรัสแล้ว)', 'ดับเบิลคลิกไฟล์ แล้วกดถัดไปจนเสร็จ', 'เปิดโปรแกรมจากไอคอนบนหน้าจอ'], activation: ['คัดลอกคีย์จากแชต หรือ โปรไฟล์ › ซื้อแล้ว', 'เปิดโปรแกรม › เมนูตั้งค่า › ใส่คีย์', 'กดยืนยัน ระบบผูกคีย์กับเครื่องนี้'], support: 'อัปเดตฟรี 1 ปี · ตอบแชตภายใน 24 ชม.', refund: 'คืนเงินเต็มจำนวนภายใน 7 วัน ถ้าติดตั้งหรือใช้งานไม่ได้', trial: true, trialDays: '14 วัน', licPreset: 'ส่วนตัว + เชิงพาณิชย์', licAllowed: LIC_ROWS.slice(0, 3) },
  },
  game: {
    key: 'game', name: 'เกม · ปลั๊กอิน', sub: 'เกม ม็อด ส่วนเสริม', icon: 'game', color: '#0E9384', bg: '#E3F7F4', layout: 'sw',
    fields: [],
    defaults: {},
  },
  bot: {
    key: 'bot', name: 'บอท · ระบบอัตโนมัติ', sub: 'บอท LINE OA ลิงก์ทดลอง', icon: 'robot', color: '#15803D', bg: '#E5F8EC', layout: 'bot',
    fields: [
      { id: 'platform', label: 'ใช้กับแพลตฟอร์มไหน', kind: 'multi', step: 'files', options: ['LINE OA', 'Facebook Messenger', 'Instagram', 'เว็บไซต์', 'TikTok', 'Telegram', 'Google Sheets', 'n8n / Make'], required: true },
      { id: 'buyerNeeds', label: 'ผู้ซื้อต้องมีบัญชี / API key อะไร', kind: 'list', step: 'files', required: true, placeholder: 'เช่น บัญชี LINE OA (ฟรี) · Channel access token' },
      { id: 'features', label: 'บอททำอะไรได้บ้าง', kind: 'list', step: 'details', required: true },
      { id: 'setupMode', label: 'การติดตั้ง', kind: 'chips', step: 'details', options: ['ติดตั้งให้ฟรี 1 ครั้ง', 'ผู้ซื้อติดตั้งเองตามคู่มือ', 'มีค่าติดตั้งแยก'], required: true },
      { id: 'setup', label: 'ขั้นตอนติดตั้ง', kind: 'list', step: 'details', required: true },
      { id: 'limits', label: 'ข้อจำกัด / โควตา', kind: 'text', step: 'details', required: true, placeholder: 'เช่น ตอบได้ 1,000 ข้อความ/เดือน ตามโควตา LINE ฟรี' },
      { id: 'trial', label: 'เปิดทดลองฟรี', kind: 'toggle', step: 'price' },
      { id: 'trialDays', label: 'ทดลองได้กี่วัน', kind: 'chips', step: 'price', options: ['3 วัน', '7 วัน', '14 วัน'], when: (s) => on(s.trial), required: (s) => on(s.trial) },
      { id: 'trialLink', label: 'ลิงก์ทดลองคุย', kind: 'text', step: 'price', when: (s) => on(s.trial), required: (s) => on(s.trial), placeholder: 'line.me/R/ti/p/@…' },
      SUPPORT, REFUND, ...LICENSE,
    ],
    defaults: { platform: ['LINE OA'], buyerNeeds: ['บัญชี LINE OA (สมัครฟรี)'], setupMode: 'ติดตั้งให้ฟรี 1 ครั้ง', setup: ['ส่งบรีฟร้านและเมนูในแชต', 'ครีเอเตอร์นัดเวลาติดตั้ง (ประมาณ 30 นาที)', 'ทดสอบคุยกับบอทแล้วเปิดใช้งานจริง'], trial: true, trialDays: '7 วัน', support: 'ดูแลฟรี 30 วัน · แก้คำตอบได้ไม่จำกัด', refund: 'ยกเลิกรายเดือนได้ทุกเมื่อ · ค่าติดตั้งคืนได้ถ้ายังไม่ได้ติดตั้ง', licPreset: 'ส่วนตัว + เชิงพาณิชย์', licAllowed: LIC_ROWS.slice(0, 2) },
  },
  course: {
    key: 'course', name: 'คอร์สออนไลน์', sub: 'บทเรียนวิดีโอ ไฟล์ประกอบ', icon: 'cap', color: '#C2410C', bg: '#FFF0E3', layout: 'course',
    fields: [
      { id: 'lessons', label: 'บทเรียน (ชื่อตอน · ความยาว)', kind: 'list', step: 'files', required: true, min: 2, placeholder: 'เช่น ตอนที่ 1 · ปูพื้น AI ทำภาพสินค้า · 09:30' },
      { id: 'freeLessons', label: 'ดูฟรีได้กี่ตอน', kind: 'chips', step: 'files', options: ['ไม่มี', '1 ตอน', '2 ตอน', '3 ตอน'], required: true },
      { id: 'materials', label: 'ไฟล์ประกอบที่ได้', kind: 'multi', step: 'files', options: ['สรุป PDF', 'ไฟล์งานตัวอย่าง', 'พรอมต์สำเร็จรูป', 'เทมเพลต', 'กลุ่มถาม-ตอบ'], required: true },
      { id: 'level', label: 'ระดับ', kind: 'chips', step: 'details', options: ['มือใหม่', 'กลาง', 'ขั้นสูง'], required: true },
      { id: 'prereq', label: 'ต้องรู้หรือมีอะไรก่อนเรียน', kind: 'text', step: 'details', required: true, placeholder: 'เช่น มีมือถือหรือคอม ไม่ต้องมีพื้นฐาน' },
      { id: 'duration', label: 'ความยาวรวม', kind: 'text', step: 'details', required: true, placeholder: 'เช่น 12 ตอน · 3 ชม.' },
      { id: 'outcomes', label: 'เรียนจบแล้วทำอะไรได้', kind: 'list', step: 'details', required: true },
      { id: 'access', label: 'ดูได้นานแค่ไหน', kind: 'chips', step: 'license', options: ['ตลอดชีพ', '1 ปี', '6 เดือน'], required: true },
      { id: 'certificate', label: 'มีใบรับรองเมื่อเรียนจบ', kind: 'toggle', step: 'license' },
      REFUND, ...LICENSE,
    ],
    defaults: { freeLessons: '1 ตอน', materials: ['สรุป PDF'], level: 'มือใหม่', access: 'ตลอดชีพ', certificate: true, refund: 'คืนเงินได้ภายใน 7 วัน ถ้าเรียนไม่เกิน 2 ตอน', licPreset: 'ส่วนตัวอย่างเดียว', licAllowed: LIC_PRESETS['ส่วนตัวอย่างเดียว'] },
  },
  font: {
    key: 'font', name: 'ฟอนต์ · สติกเกอร์', sub: 'ไอคอน พรีเซ็ต ตารางสิทธิ์', icon: 'font', color: '#D6336C', bg: '#FDEBF2', layout: 'font',
    fields: [
      { id: 'sub', label: 'เป็นแบบไหน', kind: 'chips', step: 'files', options: ['ฟอนต์', 'สติกเกอร์ LINE', 'ไอคอน', 'พรีเซ็ต / LUT', 'แปรง'], required: true },
      FILES('ไฟล์ที่ผู้ซื้อได้รับ', 'OTF TTF PNG SVG CUBE XMP ABR'),
      { id: 'formats', label: 'นามสกุลไฟล์', kind: 'multi', step: 'files', options: ['OTF', 'TTF', 'WOFF2', 'PNG', 'SVG', 'LUT (.cube)', 'XMP', 'ABR'], required: true },
      { id: 'count', label: 'จำนวนในชุด', kind: 'text', step: 'files', required: true, placeholder: 'เช่น 3 น้ำหนัก · 24 ตัว · 12 พรีเซ็ต' },
      { id: 'languages', label: 'รองรับภาษา / ตัวอักษร', kind: 'multi', step: 'details', options: ['ไทย', 'อังกฤษ', 'ตัวเลข', 'สัญลักษณ์', 'วรรณยุกต์ครบ'], when: (s) => str(s.sub) === 'ฟอนต์', required: (s) => str(s.sub) === 'ฟอนต์' },
      { id: 'compat', label: 'ใช้กับแอปอะไรได้', kind: 'text', step: 'details', required: true, placeholder: 'เช่น Windows macOS Canva Photoshop' },
      { id: 'install', label: 'วิธีติดตั้ง / ใช้งาน', kind: 'list', step: 'details', required: true },
      ...LICENSE,
    ],
    defaults: { sub: 'ฟอนต์', formats: ['OTF', 'TTF'], languages: ['ไทย', 'อังกฤษ', 'ตัวเลข'], compat: 'Windows · macOS · Canva · Photoshop · Word', install: ['แตกไฟล์ ZIP ที่ได้', 'ดับเบิลคลิกไฟล์ .otf แล้วกด “ติดตั้ง”', 'เปิดแอป เลือกฟอนต์ชื่อเดียวกับที่ซื้อ'], licPreset: 'ส่วนตัว + เชิงพาณิชย์', licAllowed: LIC_PRESETS['ส่วนตัว + เชิงพาณิชย์'] },
  },
  hire: {
    key: 'hire', name: 'รับจ้างงาน', sub: 'แพ็กเกจ รับบรีฟ', icon: 'pen', color: '#B45309', bg: '#FFF4DB', layout: 'hire',
    fields: [
      { id: 'deliverables', label: 'งานที่ส่งมอบ', kind: 'list', step: 'files', required: true, placeholder: 'เช่น มาสคอต 1 ตัว + 3 ท่าทาง' },
      { id: 'formats', label: 'ไฟล์ที่ส่งให้', kind: 'multi', step: 'files', options: ['PNG', 'JPG', 'AI', 'PSD', 'SVG', 'PDF', 'MP4', 'ไฟล์ซอร์ส'], required: true },
      { id: 'briefNeeds', label: 'ผู้ซื้อต้องเตรียมอะไรในบรีฟ', kind: 'list', step: 'details', required: true, placeholder: 'เช่น ชื่อร้านและสีที่ชอบ' },
      { id: 'timeline', label: 'ส่งงานภายใน', kind: 'chips', step: 'price', options: ['1–3 วัน', '3–7 วัน', '7–14 วัน', '14–30 วัน'], required: true },
      { id: 'revisions', label: 'แก้ไขได้', kind: 'chips', step: 'price', options: ['1 ครั้ง', '2 ครั้ง', '3 ครั้ง', '5 ครั้ง'], required: true },
      { id: 'rights', label: 'สิทธิ์ในงานที่ส่ง', kind: 'chips', step: 'license', options: ['ใช้เชิงพาณิชย์ได้ + ไฟล์ต้นฉบับ', 'ใช้เชิงพาณิชย์ได้', 'ใช้ส่วนตัวเท่านั้น'], required: true },
      { id: 'portfolio', label: 'ขอนำไปโชว์ในพอร์ต', kind: 'toggle', step: 'license' },
      REFUND,
    ],
    defaults: { formats: ['PNG', 'AI'], timeline: '3–7 วัน', revisions: '3 ครั้ง', rights: 'ใช้เชิงพาณิชย์ได้', portfolio: true, briefNeeds: ['ชื่อร้านหรือแบรนด์', 'สีหรือสไตล์ที่ชอบ', 'ภาพอ้างอิง 1–3 ภาพ', 'จะเอาไปใช้ทำอะไร'], refund: 'LUMI พักเงินไว้ คืนเต็มจำนวนถ้ายังไม่เริ่มงาน หรือส่งงานไม่ตรงบรีฟ' },
  },
  // filled in below (added 2 Nov 2026)
  media: undefined as unknown as TypeSpec,
  skill: undefined as unknown as TypeSpec,
  data: undefined as unknown as TypeSpec,
}
// เกม · ปลั๊กอิน shares the software checklist, with its own sub-types and platforms.
SPECS.game.fields = SPECS.sw.fields.map((f) =>
  f.id === 'sub' ? { ...f, options: ['เกม', 'ซอร์สโค้ดเกม', 'ปลั๊กอิน', 'ส่วนขยาย Chrome', 'ม็อด'] }
    : f.id === 'platforms' ? { ...f, options: ['Windows', 'macOS', 'เว็บ', 'Android', 'iOS', 'WordPress', 'Shopify', 'Chrome', 'Unity', 'Godot'] } : f)
SPECS.game.defaults = { ...SPECS.sw.defaults, sub: 'เกม', keyType: 'ไม่ต้องใช้คีย์' }

// ---------- 3 categories added 2 Nov 2026 (approved): วิดีโอ เสียง และเพลง · Agent Skills · ชุดข้อมูล
SPECS.media = {
  key: 'media', name: 'วิดีโอ เสียง เพลง', sub: 'วิดีโอ AI เพลง เสียงพากย์', icon: 'play', color: '#9333EA', bg: '#F5EBFF', layout: 'media',
  fields: [
    { id: 'sub', label: 'เป็นแบบไหน', kind: 'chips', step: 'files', options: ['วิดีโอ AI', 'เสียงพากย์ AI', 'เพลงต้นฉบับ', 'เอฟเฟกต์เสียง', 'เทมเพลตตัดต่อวิดีโอ'], required: true },
    FILES('ไฟล์ที่ผู้ซื้อได้รับ', 'MP4 MOV WAV MP3 หรือไฟล์เทมเพลต · ไม่มีลายน้ำ · สแกนไวรัสทุกไฟล์'),
    { id: 'count', label: 'จำนวนชิ้นในชุด', kind: 'text', step: 'files', required: true, placeholder: 'เช่น 1 คลิป หรือ 10 เพลง' },
    { id: 'duration', label: 'ความยาว', kind: 'text', step: 'files', required: true, placeholder: 'เช่น 15 วินาที · หรือ รวม 32 นาที (เพลงละ 2–4 นาที)' },
    { id: 'formats', label: 'นามสกุลไฟล์', kind: 'multi', step: 'files', options: ['MP4', 'MOV', 'WAV', 'MP3', 'เทมเพลต CapCut', 'Premiere (.prproj)', 'After Effects (.aep)', 'SRT (ซับไตเติล)'], required: true },
    { id: 'quality', label: 'ความละเอียด / บิตเรต', kind: 'chips', step: 'files', options: ['4K 30fps', '1080p 60fps', '1080p 30fps', '9:16 1080×1920', 'WAV 48kHz 24-bit', 'MP3 320 kbps'], required: true },
    { id: 'appVersion', label: 'แอปตัดต่อที่ต้องใช้ + เวอร์ชัน', kind: 'text', step: 'files', when: (s) => str(s.sub) === 'เทมเพลตตัดต่อวิดีโอ', required: (s) => str(s.sub) === 'เทมเพลตตัดต่อวิดีโอ', placeholder: 'เช่น CapCut มือถือ 12.0 ขึ้นไป (ฟรี)' },
    { id: 'aiTool', label: 'สร้างด้วยเครื่องมือ AI อะไร', kind: 'chips', step: 'details', options: ['Runway', 'Kling', 'Sora', 'Veo', 'Suno', 'Udio', 'ElevenLabs', 'CapCut AI', 'ไม่ได้ใช้ AI', 'อื่น ๆ'], required: true, hint: 'แสดงบนหน้าสินค้าให้ผู้ซื้อรู้ที่มา' },
    { id: 'howUse', label: 'วิธีใช้งาน (ทีละขั้น)', kind: 'list', step: 'details', required: true },
    { id: 'noClone', label: 'ยืนยัน: ไม่ได้เลียนเสียงหรือหน้าบุคคลจริงโดยไม่ได้รับอนุญาต', kind: 'toggle', step: 'license', required: true, mustBeOn: true, hint: 'ห้ามโคลนเสียงคนดัง/บุคคลจริง · ฝ่าฝืนถูกถอดสินค้า' },
    { id: 'musicLic', label: 'สิทธิ์เพลง / เสียง', kind: 'chips', step: 'license', options: ['ใช้ในคลิปโซเชียลได้ ไม่ติดลิขสิทธิ์', 'ใช้ในโฆษณา ทีวี และสตรีมได้', 'ใช้ส่วนตัวเท่านั้น'], required: true },
    REFUND, ...LICENSE,
  ],
  defaults: { sub: 'วิดีโอ AI', formats: ['MP4'], quality: '1080p 30fps', musicLic: 'ใช้ในคลิปโซเชียลได้ ไม่ติดลิขสิทธิ์', howUse: ['ดาวน์โหลดไฟล์จากแชต หรือ โปรไฟล์ › ซื้อแล้ว', 'นำเข้าแอปตัดต่อหรืออัปโหลดขึ้นโซเชียลได้ทันที'], refund: 'คืนเงินได้ภายใน 7 วัน ถ้าไฟล์เปิดไม่ได้หรือไม่ตรงคำอธิบาย', licPreset: 'ส่วนตัว + เชิงพาณิชย์', licAllowed: LIC_PRESETS['ส่วนตัว + เชิงพาณิชย์'] },
}
SPECS.skill = {
  key: 'skill', name: 'Agent Skills', sub: 'สกิล ชุดความรู้ให้ AI agent', icon: 'bulb', color: '#0F766E', bg: '#E2F6F2', layout: 'skill',
  fields: [
    { id: 'platforms', label: 'ใช้กับ AI agent ตัวไหน', kind: 'multi', step: 'files', options: ['Claude (Agent Skills)', 'ChatGPT (GPTs / Projects)', 'Cursor (Rules / Skills)', 'Gemini Gems', 'Grok', 'OpenAI Agents SDK', 'n8n / LangChain agent'], required: true },
    FILES('ไฟล์สกิล', 'เช่น ZIP ที่มี SKILL.md สคริปต์ เอกสารอ้างอิง · สแกนไวรัสทุกไฟล์'),
    { id: 'contents', label: 'ในชุดมีไฟล์อะไรบ้าง', kind: 'list', step: 'files', required: true, placeholder: 'เช่น SKILL.md — คำสั่งหลักของสกิล' },
    { id: 'version', label: 'เวอร์ชัน', kind: 'text', step: 'files', required: true, placeholder: 'เช่น v1.0' },
    { id: 'changelog', label: 'ประวัติอัปเดต', kind: 'list', step: 'files' },
    { id: 'features', label: 'สกิลนี้ทำให้ agent ทำอะไรได้', kind: 'list', step: 'details', required: true },
    { id: 'install', label: 'วิธีติดตั้ง (ทีละขั้น)', kind: 'list', step: 'details', required: true, min: 2 },
    { id: 'buyerNeeds', label: 'ผู้ซื้อต้องมีบัญชี / แพ็กเกจอะไร', kind: 'list', step: 'details', required: true, placeholder: 'เช่น Claude Pro ขึ้นไป (เปิดใช้ Skills ได้)' },
    { id: 'examples', label: 'ตัวอย่างคำสั่งที่ใช้ได้', kind: 'list', step: 'details', placeholder: 'เช่น “ตอบลูกค้าที่ถามค่าส่งให้หน่อย”' },
    SUPPORT, REFUND, ...LICENSE,
  ],
  defaults: { platforms: ['Claude (Agent Skills)'], version: 'v1.0', install: ['ดาวน์โหลดไฟล์ ZIP จากแชต', 'เปิด Claude › Settings › Capabilities › Skills › Upload skill', 'เลือกไฟล์ ZIP แล้วเปิดใช้งาน'], support: 'อัปเดตฟรี 6 เดือน · ตอบแชตภายใน 24 ชม.', refund: 'คืนเงินได้ภายใน 7 วัน ถ้าติดตั้งไม่ได้', licPreset: 'ส่วนตัว + เชิงพาณิชย์', licAllowed: LIC_PRESETS['ส่วนตัว + เชิงพาณิชย์'] },
}
SPECS.data = {
  key: 'data', name: 'ชุดข้อมูล', sub: 'CSV JSON สำหรับแอป/AI', icon: 'grid', color: '#1D4ED8', bg: '#E8EFFF', layout: 'data',
  fields: [
    FILES('ไฟล์ชุดข้อมูล', 'CSV JSON Parquet ฯลฯ · สแกนไวรัสทุกไฟล์'),
    { id: 'formats', label: 'รูปแบบไฟล์', kind: 'multi', step: 'files', options: ['CSV', 'JSON', 'JSONL', 'Parquet', 'XLSX', 'SQL'], required: true },
    { id: 'size', label: 'ขนาด (แถว · คอลัมน์ · MB)', kind: 'text', step: 'files', required: true, placeholder: 'เช่น 5,000 แถว · 12 คอลัมน์ · 3.2 MB' },
    { id: 'columns', label: 'คอลัมน์ / โครงสร้างข้อมูล', kind: 'list', step: 'details', required: true, min: 2, placeholder: 'เช่น name — ชื่อเมนู (ข้อความ)' },
    { id: 'source', label: 'แหล่งที่มาของข้อมูล', kind: 'textarea', step: 'details', required: true, placeholder: 'เช่น รวบรวมเองจากเมนูร้านที่ได้รับอนุญาต 120 ร้าน ระหว่าง ม.ค.–ก.ย. 2569' },
    { id: 'updates', label: 'การอัปเดต', kind: 'chips', step: 'details', options: ['ครั้งเดียว', 'อัปเดตรายเดือน', 'อัปเดตรายไตรมาส'], required: true },
    { id: 'useCases', label: 'นำไปใช้ทำอะไรได้', kind: 'list', step: 'details', required: true },
    { id: 'rights', label: 'ยืนยัน: ฉันมีสิทธิ์นำข้อมูลนี้มาขาย/แจกต่อ', kind: 'toggle', step: 'license', required: true, mustBeOn: true },
    { id: 'noPII', label: 'ยืนยัน: ไม่มีข้อมูลส่วนบุคคล (ชื่อ เบอร์ อีเมล เลขบัตร ที่อยู่)', kind: 'toggle', step: 'license', required: true, mustBeOn: true, hint: 'ตาม PDPA · LUMI สุ่มตรวจไฟล์ก่อนเปิดขาย' },
    REFUND, ...LICENSE,
  ],
  defaults: { formats: ['CSV'], updates: 'ครั้งเดียว', refund: 'คืนเงินได้ภายใน 7 วัน ถ้าไฟล์ไม่ตรงคำอธิบาย', licPreset: 'ส่วนตัว + เชิงพาณิชย์', licAllowed: LIC_PRESETS['ส่วนตัว + เชิงพาณิชย์'] },
}

export const SELL_TYPES = Object.values(SPECS)
export const visible = (f: Field, s: Spec) => !f.when || f.when(s)
const isReq = (f: Field, s: Spec) => visible(f, s) && (typeof f.required === 'function' ? f.required(s) : !!f.required)
function filled(f: Field, v: SpecValue | undefined) {
  if (f.kind === 'toggle') return f.mustBeOn ? v === true : true
  if (f.kind === 'files') { const fs = filesOf(v); return fs.length >= (f.min ?? 1) && fs.every((x) => x.scan === 'ok') }
  if (f.kind === 'multi' || f.kind === 'list') return arr(v).length >= (f.min ?? 1)
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
  out.push({ id: 'title', label: 'ชื่อผลงาน', ok: d.title.trim().length >= 4, step: 2, note: 'อย่างน้อย 4 ตัวอักษร' })
  out.push({ id: 'use', label: 'เหมาะกับใคร / ใช้ทำอะไร', ok: d.use.trim().length >= 4, step: 2 })
  out.push({ id: 'desc', label: 'รายละเอียด', ok: d.desc.trim().length >= 10, step: 2, note: 'อย่างน้อย 10 ตัวอักษร' })
  for (const f of t.fields.filter((f) => isReq(f, d.spec) && f.step === 'details')) out.push(chk(f, d))
  const priced = d.free || d.options.some((o) => o.on && o.price > 0)
  out.push({ id: 'price', label: d.free ? 'แจกฟรี' : 'ราคา (เปิดขายอย่างน้อย 1 แบบ)', ok: priced, step: 3 })
  for (const f of t.fields.filter((f) => isReq(f, d.spec) && f.step === 'price')) out.push(chk(f, d))
  for (const f of t.fields.filter((f) => isReq(f, d.spec) && f.step === 'license')) out.push(chk(f, d))
  return out
}
function chk(f: Field, d: ListingDraft): CheckItem {
  const ok = filled(f, d.spec[f.id])
  let note: string | undefined
  if (f.kind === 'files') { const fs = filesOf(d.spec[f.id]); note = fs.some((x) => x.scan === 'scan') ? 'กำลังสแกนไวรัส' : fs.some((x) => x.scan === 'fail') ? 'มีไฟล์ไม่ผ่านการสแกน' : undefined }
  if ((f.kind === 'list') && (f.min ?? 1) > 1) note = `อย่างน้อย ${f.min} รายการ`
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
export function layoutOf(p: Product): DetailKind {
  if (p.dk) return p.dk
  if (p.price === 0 && p.kind !== 'commission') return 'free'
  return SPECS[sellTypeOf(p)].layout
}

/** Plausible complete spec for the built-in SAMPLE works (they predate the wizard). */
export function specOf(p: Product): Spec {
  if (p.spec) return p.spec
  const t = sellTypeOf(p)
  const d: Spec = { ...SPECS[t].defaults }
  const slug = p.id
  const l = p.label ?? ''
  if (t === 'img') Object.assign(d, { count: /ชุด (\d+)/.exec(p.title)?.[1] ? `${/ชุด (\d+)/.exec(p.title)![1]} ภาพ` : '1 ภาพ', files: [JSON.stringify({ name: `${slug}-4k.png`, size: '8.4 MB', scan: 'ok' })], sellPrompt: !!p.hasPrompt, prompt: p.hasPrompt ? `/imagine prompt: ${p.title}, soft cinematic light, rich thai details, ultra detailed --ar 3:4 --stylize 600` : undefined, model: p.hasPrompt ? 'Midjourney v7' : undefined, settings: p.hasPrompt ? '--ar 3:4 --stylize 600 --seed 2569' : undefined, aspect: p.image && p.image.w > p.image.h ? '16:9' : p.image && p.image.w === p.image.h ? '1:1' : '3:4' })
  if (t === 'tpl') {
    const web = /เว็บ/.test(l), print = /พิมพ์/.test(l)
    Object.assign(d, web ? { apps: ['เว็บ (HTML)', 'Figma'], appVersion: 'เบราว์เซอร์ใดก็ได้ · Figma ฟรี', formats: ['HTML', 'FIG'], count: '1 หน้า · 6 ส่วน', size: 'รองรับมือถือและคอม', files: [JSON.stringify({ name: 'bakery-site.zip', size: '6.1 MB', scan: 'ok' })], howOpen: ['แตกไฟล์ ZIP', 'เปิด index.html ด้วยเบราว์เซอร์เพื่อดู', 'แก้ข้อความใน Figma หรือไฟล์ HTML แล้วอัปโหลดขึ้นโฮสต์ (เช่น GitHub Pages ฟรี)'] }
      : print ? { apps: ['เว็บ (HTML)'], appVersion: 'โปรแกรมอ่าน PDF ทั่วไป', formats: ['PDF'], count: '40 หน้า', size: 'A4 300 dpi', files: [JSON.stringify({ name: 'coloring-40p.pdf', size: '22 MB', scan: 'ok' })], editable: ['ขนาด / เลย์เอาต์'], howOpen: ['ดาวน์โหลด PDF จากแชต', 'สั่งพิมพ์ขนาด A4 แบบ “พอดีหน้า”'] }
        : { count: '30 แบบ', size: '1080×1350 px (IG 4:5)', canvaLink: 'canva.com/design/DAF-sample/remix', files: [JSON.stringify({ name: 'cafe-30.psd', size: '86 MB', scan: 'ok' })], formats: ['ลิงก์ Canva', 'PSD', 'PDF'], apps: ['Canva', 'Photoshop'], appVersion: 'Canva ฟรี · Photoshop 2023 ขึ้นไป' })
    d.fonts = ['Prompt — fonts.google.com/specimen/Prompt', 'Mali — fonts.google.com/specimen/Mali']
  }
  if (t === 'sw' || t === 'game') Object.assign(d, { sub: /แอป/.test(l) ? 'แอปมือถือ' : /เกม/.test(l) ? 'ซอร์สโค้ดเกม' : /ปลั๊กอิน/.test(l) ? 'ปลั๊กอิน' : /ส่วนขยาย/.test(l) ? 'ส่วนขยาย Chrome' : 'โปรแกรม', platforms: p.platforms ?? ['Windows'], version: 'v1.3', changelog: ['v1.3 · เร็วขึ้น 2 เท่า แก้บั๊กภาษาไทย', 'v1.2 · เพิ่มรายงานรายวัน', 'v1.0 · เปิดตัว'], minSpec: /iOS|Android/.test((p.platforms ?? []).join()) ? 'iOS 15 / Android 10 ขึ้นไป' : 'RAM 4 GB · พื้นที่ว่าง 200 MB', files: [JSON.stringify({ name: `${slug}-v1.3.zip`, size: '48 MB', scan: 'ok' })] })
  if (t === 'game' && /เกม/.test(l)) Object.assign(d, { platforms: ['เว็บ', 'Android'], deps: 'Godot 4.2 (ฟรี) ถ้าจะแก้ซอร์ส', install: ['แตกไฟล์ ZIP', 'เปิดโปรเจกต์ด้วย Godot 4.2', 'กด Run เพื่อเล่น หรือ Export เป็น APK'] })
  if (t === 'sw' && p.kind === 'tool' && !/โปรแกรม|แอป/.test(l)) Object.assign(d, { sub: 'เว็บแอป', platforms: ['เว็บ'], keyType: 'สมาชิกรายเดือน', minSpec: 'เบราว์เซอร์ Chrome / Safari รุ่นล่าสุด', install: ['ไม่ต้องติดตั้ง เปิดลิงก์ที่ได้ในแชต', 'ล็อกอินด้วยอีเมลที่ใช้ซื้อ'], deps: `บัญชี ${(p.platforms ?? []).join(' / ')}` })
  if (t === 'bot') Object.assign(d, { platform: p.platforms ?? ['LINE OA'], features: p.kind === 'bot' ? [p.use, 'ตอบลูกค้าอัตโนมัติ 24 ชม.', 'ส่งออเดอร์เข้า Google Sheets', 'แจ้งเตือนเจ้าของร้านใน LINE'] : [p.use, 'ตั้งเวลาทำงานเองทุกวัน', 'ดูรายงานย้อนหลังได้'], buyerNeeds: p.kind === 'bot' ? ['บัญชี LINE OA (สมัครฟรี)', 'เมนูและราคา (ไฟล์หรือรูปก็ได้)'] : [`บัญชี ${(p.platforms ?? ['Google']).join(' · ')}`, 'บัญชี n8n Cloud หรือเครื่องที่ติดตั้ง n8n (ฟรี)'], limits: p.kind === 'bot' ? 'ตอบได้ตามโควตาข้อความของ LINE OA (แพ็กเกจฟรี 300 ข้อความ/เดือน)' : 'ทำงานได้ 2,500 ครั้ง/เดือน ตามแพ็กเกจ n8n Starter', trialLink: 'line.me/R/ti/p/@lumi-demo' })
  if (t === 'course') Object.assign(d, { lessons: ['ตอนที่ 1 · ปูพื้นและเครื่องมือที่ต้องใช้ · 09:30', 'ตอนที่ 2 · เขียนพรอมต์ให้ได้ภาพตรงใจ · 14:20', 'ตอนที่ 3 · จัดแสงแบบสตูดิโอ · 18:05', 'ตอนที่ 4 · แต่งพื้นหลังโทนพาสเทล · 12:40', 'ตอนที่ 5 · ทำภาพชุดลง Shopee · 16:10', 'ตอนที่ 6 · เวิร์กช็อปปิดคอร์ส · 22:00'], duration: p.meta ?? '6 ตอน · 1.5 ชม.', prereq: 'มีมือถือหรือคอม ไม่ต้องมีพื้นฐาน', outcomes: ['ทำภาพสินค้าสวยได้เองในวันเดียว', 'มีพรอมต์สำเร็จรูปไว้ใช้ต่อ', 'รู้วิธีทำภาพชุดลงร้านออนไลน์'], materials: ['สรุป PDF', 'พรอมต์สำเร็จรูป'] })
  if (t === 'course' && /อีบุ๊ก/.test(l)) Object.assign(d, { lessons: ['บทที่ 1 · พรอมต์เขียนแคปชันขาย', 'บทที่ 2 · พรอมต์ตอบแชตลูกค้า', 'บทที่ 3 · พรอมต์ทำโปรโมชัน'], duration: p.meta ?? '24 หน้า', materials: ['สรุป PDF', 'พรอมต์สำเร็จรูป'], certificate: false })
  if (t === 'font') {
    const sticker = /สติกเกอร์/.test(l)
    Object.assign(d, sticker ? { sub: 'สติกเกอร์ LINE', formats: ['PNG'], count: /(\d+) (ตัว|อารมณ์)/.exec(p.title)?.[0] ?? '8 ตัว', compat: 'LINE (ส่งเป็นรูป) · LINE Creators Market', install: ['ดาวน์โหลดไฟล์ PNG พื้นใสจากแชต', 'บันทึกลงอัลบั้มมือถือ', 'ส่งในแชตเป็นรูป หรืออัปขึ้น LINE Creators Market'], files: [JSON.stringify({ name: `${slug}-stickers.zip`, size: '3.2 MB', scan: 'ok' })] }
      : { count: '3 น้ำหนัก (ปกติ หนา บาง)', files: [JSON.stringify({ name: `${slug}-Regular.otf`, size: '420 KB', scan: 'ok' }), JSON.stringify({ name: `${slug}-Bold.otf`, size: '436 KB', scan: 'ok' })] })
  }
  if (t === 'media') {
    const music = /เพลง/.test(l), tplv = /เทมเพลต/.test(l)
    Object.assign(d, music ? { sub: 'เพลงต้นฉบับ', count: '10 เพลง', duration: 'รวม 32 นาที (เพลงละ 2–4 นาที)', formats: ['WAV', 'MP3'], quality: 'WAV 48kHz 24-bit', aiTool: 'Suno', musicLic: 'ใช้ในคลิปโซเชียลได้ ไม่ติดลิขสิทธิ์', files: [JSON.stringify({ name: 'lukthung-chill-10.zip', size: '410 MB', scan: 'ok' })], howUse: ['ดาวน์โหลด ZIP จากแชต แล้วแตกไฟล์', 'ลากเพลงเข้า CapCut / Premiere เป็นแทร็กเสียง', 'ใส่เครดิต “Music by Ton Sheets” ในคำบรรยาย (ไม่บังคับ)'] }
      : tplv ? { sub: 'เทมเพลตตัดต่อวิดีโอ', count: '5 แบบ', duration: 'แบบละ 12–20 วินาที', formats: ['เทมเพลต CapCut'], quality: '9:16 1080×1920', appVersion: 'CapCut มือถือ 12.0 ขึ้นไป (ฟรี)', aiTool: 'CapCut AI', files: [JSON.stringify({ name: 'skincare-capcut-links.pdf', size: '180 KB', scan: 'ok' })], howUse: ['เปิดลิงก์เทมเพลตในไฟล์ PDF ด้วยมือถือ', 'กด “ใช้เทมเพลต” ใน CapCut', 'เลือกคลิปสินค้าของคุณ 3–5 คลิป แล้วกดส่งออก'] }
        : { sub: 'วิดีโอ AI', count: '1 คลิป + เวอร์ชันไม่มีข้อความ', duration: '15 วินาที', formats: ['MP4', 'SRT (ซับไตเติล)'], quality: '9:16 1080×1920', aiTool: 'Kling', files: [JSON.stringify({ name: 'cafe-promo-15s.mp4', size: '38 MB', scan: 'ok' }), JSON.stringify({ name: 'cafe-promo-clean.mp4', size: '36 MB', scan: 'ok' })], howUse: ['ดาวน์โหลด MP4 จากแชต', 'โพสต์ลง Reels / TikTok ได้ทันที หรือเปลี่ยนข้อความใน CapCut', 'ใช้ไฟล์ SRT ถ้าอยากแก้คำบรรยาย'] })
    d.noClone = true
  }
  if (t === 'skill') Object.assign(d, /ภาษี/.test(p.title)
    ? { platforms: ['ChatGPT (GPTs / Projects)', 'Claude (Agent Skills)'], contents: ['SKILL.md — วิธีตอบคำถามภาษีร้านค้า', 'tax-th-2569.md — สรุปเกณฑ์ VAT และภาษีเงินได้', 'examples.md — ตัวอย่างคำถาม-คำตอบ 40 ข้อ'], version: 'v2.1', changelog: ['v2.1 · อัปเดตเกณฑ์ปี 2569', 'v2.0 · เพิ่มเรื่องใบกำกับภาษีอิเล็กทรอนิกส์'], features: ['ตอบเรื่องจด VAT เมื่อรายได้เกิน 1.8 ล้าน', 'คำนวณภาษีเงินได้คร่าว ๆ จากยอดขาย', 'บอกเอกสารที่ต้องเก็บ'], buyerNeeds: ['ChatGPT Plus หรือ Claude Pro ขึ้นไป'], examples: ['ขายของออนไลน์ปีละ 2 ล้าน ต้องจด VAT ไหม'], files: [JSON.stringify({ name: 'tax-skill-v2.1.zip', size: '140 KB', scan: 'ok' })] }
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
      deliver.push(lic.length > 1 ? 'ใบอนุญาตใช้เชิงพาณิชย์ (PDF)' : 'ใบอนุญาตใช้ส่วนตัว (PDF)')
      howto.push('ดาวน์โหลดไฟล์จากแชต หรือ โปรไฟล์ › ซื้อแล้ว', 'เปิดด้วยแอปดูรูป Canva หรือ Photoshop ได้ทันที')
      if (on(s.sellPrompt)) howto.push(`คัดลอกพรอมต์ไปวางใน ${str(s.model)} แล้วใส่ค่าตั้ง ${str(s.settings)} เพื่อสร้างภาพแนวเดียวกัน`)
      needs.push('ไม่ต้องติดตั้งอะไรเพิ่ม')
      if (on(s.sellPrompt)) needs.push(`บัญชี ${str(s.model)} (ถ้าอยากสร้างภาพเอง)`)
      facts.push(['ความละเอียด', str(s.resolution)], ['สัดส่วน', str(s.aspect)], ['ไฟล์', list(fm)])
      if (on(s.sellPrompt)) facts.push(['โมเดล', str(s.model)])
      break
    case 'tpl':
      deliver.push(`${str(s.count)} · ขนาด ${str(s.size)}`, `ไฟล์ ${list(fm)}`)
      if (arr(s.apps).includes('Canva')) deliver.push('ลิงก์ Canva แบบ “ใช้เป็นเทมเพลต” (ส่งในแชตหลังจ่าย)')
      deliver.push('รายชื่อฟอนต์พร้อมลิงก์โหลดฟรี', 'คู่มือแก้ไขทีละขั้น')
      howto.push(...arr(s.howOpen))
      needs.push(`แอป: ${arr(s.apps).join(' / ')} (${str(s.appVersion)})`, ...arr(s.fonts).map((f) => `ฟอนต์ ${f}`))
      facts.push(['แก้ได้', list(arr(s.editable))], ['ขนาด', str(s.size)], ['ไฟล์', list(fm)])
      break
    case 'sw': case 'game':
      deliver.push(`ไฟล์ติดตั้ง ${files.join(', ') || '-'} (สแกนไวรัสแล้ว ปลอดภัย)`)
      if (str(s.keyType) !== 'ไม่ต้องใช้คีย์') deliver.push(`คีย์ใช้งานแบบ${str(s.keyType)} ส่งในแชตทันทีหลังจ่าย`)
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
      facts.push(['แพลตฟอร์ม', list(arr(s.platform))], ['ติดตั้ง', str(s.setupMode)], ['ทดลอง', on(s.trial) ? str(s.trialDays) : 'ไม่มี'])
      break
    case 'course':
      deliver.push(`${arr(s.lessons).length} บทเรียน · ${str(s.duration)}`, ...arr(s.materials).map((m) => `ไฟล์ประกอบ: ${m}`), `ดูได้ ${str(s.access)}`)
      if (on(s.certificate)) deliver.push('ใบรับรองเมื่อเรียนจบ')
      howto.push('ซื้อแล้วไปที่ โปรไฟล์ › ซื้อแล้ว › เริ่มเรียน', 'ดูต่อจากตอนล่าสุดได้ทุกเครื่อง', 'ติดตรงไหนถามผู้สอนในแชต แนบเลขตอนและนาทีได้')
      needs.push(str(s.prereq), 'เรียนผ่านแอป LUMI หรือเว็บเบราว์เซอร์')
      facts.push(['ระดับ', str(s.level)], ['ความยาว', str(s.duration)], ['ดูฟรี', str(s.freeLessons)], ['เข้าถึง', str(s.access)])
      break
    case 'font':
      deliver.push(`${str(s.count)} · ไฟล์ ${list(fm)}`)
      if (files.length) deliver.push(`ไฟล์: ${files.join(', ')}`)
      if (arr(s.languages).length) deliver.push(`รองรับ ${list(arr(s.languages))}`)
      deliver.push('ตารางสิทธิ์และใบอนุญาต (PDF)')
      howto.push(...arr(s.install))
      needs.push(`ใช้กับ ${str(s.compat)}`)
      facts.push(['ประเภท', str(s.sub)], ['ไฟล์', list(fm)], ['จำนวน', str(s.count)])
      break
    case 'media':
      deliver.push(`${str(s.count)} · ${str(s.duration)}`, `ไฟล์ ${list(fm)} · ${str(s.quality)}`)
      if (files.length) deliver.push(`ไฟล์: ${files.join(', ')}`)
      deliver.push(`สิทธิ์: ${str(s.musicLic)}`, 'ไม่มีลายน้ำ · สแกนไวรัสแล้ว')
      howto.push(...arr(s.howUse))
      needs.push(str(s.appVersion) || 'แอปเล่นวิดีโอ/เสียง หรือแอปตัดต่อใดก็ได้')
      facts.push(['ประเภท', str(s.sub)], ['ความยาว', str(s.duration)], ['คุณภาพ', str(s.quality)], ['สร้างด้วย', str(s.aiTool)], ['เสียง/หน้าคนจริง', on(s.noClone) ? 'ไม่ได้โคลน (ยืนยันแล้ว)' : '-'])
      break
    case 'skill':
      deliver.push(...arr(s.contents), `เวอร์ชัน ${str(s.version)}`, str(s.support))
      howto.push(...arr(s.install), ...arr(s.examples).map((e) => `ลองสั่ง: “${e}”`))
      needs.push(`ใช้กับ ${list(arr(s.platforms))}`, ...arr(s.buyerNeeds))
      facts.push(['ใช้กับ', list(arr(s.platforms))], ['เวอร์ชัน', str(s.version)], ['ไฟล์ในชุด', `${arr(s.contents).length} ไฟล์`])
      break
    case 'data':
      deliver.push(`${str(s.size)}`, `ไฟล์ ${list(fm)}`, ...files.map((f) => `ไฟล์: ${f}`), `คำอธิบายคอลัมน์ ${arr(s.columns).length} รายการ (data dictionary)`, `การอัปเดต: ${str(s.updates)}`)
      howto.push('ดาวน์โหลดไฟล์จากแชต หรือ โปรไฟล์ › ซื้อแล้ว', `เปิดด้วย Excel / Google Sheets (CSV) หรือโค้ด เช่น pandas.read_csv()`, ...arr(s.useCases).map((u) => `ใช้ได้กับ: ${u}`))
      needs.push('โปรแกรมเปิดไฟล์ตาราง หรือภาษาโปรแกรมที่อ่าน CSV/JSON ได้')
      facts.push(['ขนาด', str(s.size)], ['รูปแบบ', list(fm)], ['อัปเดต', str(s.updates)], ['ข้อมูลส่วนบุคคล', on(s.noPII) ? 'ไม่มี (ยืนยันแล้ว)' : '-'], ['สิทธิ์เผยแพร่', on(s.rights) ? 'ผู้ขายยืนยันแล้ว' : '-'])
      break
    case 'hire':
      deliver.push(...arr(s.deliverables), `ไฟล์ ${list(fm)}`, `แก้ไขได้ ${str(s.revisions)}`, `ส่งงานภายใน ${str(s.timeline)}`, `สิทธิ์: ${str(s.rights)}`)
      howto.push('ส่งบรีฟในแชต (มีแบบฟอร์มให้)', 'ครีเอเตอร์ส่งใบเสนอราคา คุณกดรับ', 'ชำระเงิน LUMI พักเงินไว้ก่อน', 'ครีเอเตอร์อัปเดตความคืบหน้าและส่งงาน', 'ตรวจงาน ขอแก้ หรือกดรับงาน แล้ว LUMI จึงโอนเงิน')
      needs.push(...arr(s.briefNeeds))
      facts.push(['ส่งงาน', str(s.timeline)], ['แก้ไข', str(s.revisions)], ['สิทธิ์', str(s.rights)])
      break
  }
  return { deliver: deliver.filter(Boolean), howto, needs: needs.filter(Boolean), facts: facts.filter(([, v]) => !!v), refund: str(s.refund) || undefined, support: str(s.support) || undefined, lic: t === 'hire' ? undefined : lic }
}
