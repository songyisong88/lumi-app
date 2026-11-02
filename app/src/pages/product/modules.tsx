/** Type-specific blocks of the product page (approved product-b modules). */
import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { copyText, Img } from '../../components/ui'
import { toast } from '../../services/toast'
import { arr, filesOf, on, str, type Spec } from '../../data/listingSpec'
import { galleryOf } from '../../data/productExtras'
import { baht } from '../../data/sampleData'
import type { DetailKind, Product, ProductOption } from '../../data/types'
import s from './Product.module.css'

const PAL = ['#2B1B4F', '#5B3FA8', '#E9A86B', '#F4D9B0', '#C2416B']
const Ok = ({ children }: { children: React.ReactNode }) => <div className={s.ok}><span className="ok-ic"><Icon name="check" size={13} stroke={3} /></span>{children}</div>

export function Modules({ p, L, spec, opts, optId, setOptId, onTip, onTrial, onLesson, unlocked = false }: {
  unlocked?: boolean; p: Product; L: DetailKind; spec: Spec; opts: ProductOption[]; optId?: string; setOptId: (v: string) => void; onTip: (amount?: number) => void; onTrial: () => void; onLesson: () => void
}) {
  const [fontText, setFontText] = useState('')
  const g = galleryOf(p)
  switch (L) {
    case 'img':
      return (
        <>
          <div className={s.st}>โทนสีของภาพนี้</div>
          <div className={s.sw}>{PAL.map((c) => <div key={c} style={{ background: c }} />)}</div>
          {on(spec.sellPrompt) && <>
            <div className={s.st}>สูตรพรอมต์</div>
            {unlocked
              ? <div className={s.blur}><button className={s.lk} onClick={() => { copyText(str(spec.prompt)); toast('คัดลอกพรอมต์แล้ว') }}><Icon name="copy" size={11} color="#fff" stroke={2.4} />คัดลอก</button>{str(spec.prompt)}</div>
              : <div className={s.blur}><span className={s.lk}><Icon name="lock" size={11} color="#fff" stroke={2.4} />ปลดล็อกหลังซื้อ</span>
                {str(spec.prompt).slice(0, 48)}<em aria-hidden>{str(spec.prompt).slice(48).replace(/[^\s]/g, '•')}</em></div>}
          </>}
        </>
      )
    case 'tpl':
      return (
        <>
          <div className={s.st}>ตัวอย่างในชุด</div>
          <div className={`hscroll ${s.canva}`}>{[...g, ...g].slice(0, 4).map((x, i) => <Img key={i} src={x} className={s.canvaI} />)}</div>
          {arr(spec.editable).length > 0 && <><div className={s.st}>{arr(spec.formats).includes('PDF') && arr(spec.formats).length === 1 ? 'ใช้งานยังไง' : 'แก้อะไรได้บ้าง'}</div>
          {arr(spec.editable).map((t) => <Ok key={t}>{t}</Ok>)}</>}
          {arr(spec.apps).includes('Canva') && <div className={s.scan} style={{ background: '#EAF1FF', color: '#1E40AF' }}><Icon name="link" size={20} color="#2563EB" /><div><b>ได้ลิงก์ Canva ทันทีหลังซื้อ</b>ใช้ Canva ฟรีได้ ไม่ต้องสมัคร Pro</div></div>}
        </>
      )
    case 'sw':
      return (
        <>
          <div className={s.st}>ใช้กับเครื่องของคุณได้ไหม</div>
          <div className={s.cmpt}>
            {arr(spec.platforms).map((x) => <div key={x}><Icon name={/iOS|Android/.test(x) ? 'phone' : /เว็บ|Chrome/.test(x) ? 'globe' : 'monitor'} size={18} color="#4F46E5" />{x}<span className={s.yes}>รองรับ</span></div>)}
            <div><Icon name="box" size={18} color="#8A86A0" />{str(spec.minSpec)}<span className="muted">ขั้นต่ำ</span></div>
          </div>
          <div className={s.st}>มีอะไรใหม่</div>
          <div className={s.box}>{arr(spec.changelog).map((c) => <div key={c} className={s.ok}><Icon name="rocket" size={15} color="var(--p)" />{c}</div>)}</div>
        </>
      )
    case 'bot':
      return (
        <>
          {on(spec.trial) && <>
            <div className={s.st}>ลองก่อน ไม่ต้องจ่าย</div>
            <button className={`${s.trial} press`} onClick={onTrial}><span className={s.q}><Icon name="qr" size={60} stroke={1.6} /></span><span><b>ทดลองฟรี {str(spec.trialDays)}</b><small>{/line\.me/.test(str(spec.trialLink)) ? 'สแกนแล้วลองคุยกับบอทได้เลย' : 'เปิดลิงก์แล้วลองใช้ได้เลย'}</small><span className={s.g}>เปิดลิงก์ทดลอง</span></span></button>
          </>}
          {arr(spec.demo).length > 0 && <div className={s.demo}>{arr(spec.demo).map((x, i) => <div key={i} className={i % 2 ? s.da : s.dq}>{x}</div>)}</div>}
          <div className={s.st}>ทำอะไรได้บ้าง</div>
          {arr(spec.features).map((f) => <Ok key={f}>{f}</Ok>)}
        </>
      )
    case 'course': {
      const free = parseInt(str(spec.freeLessons)) || 0
      return (
        <>
          <div className={s.st}>{/อีบุ๊ก/.test(p.label ?? '') ? `เนื้อหา ${arr(spec.lessons).length} บท` : `บทเรียน ${arr(spec.lessons).length} ตอน`}</div>
          <div className={s.les}>{arr(spec.lessons).map((l, i) => {
            const [a, b, c] = l.split(' · ')
            const fr = i < free
            return <button key={l} className={fr ? s.fr : ''} onClick={() => fr && onLesson()}><i>{fr ? <Icon name="play" size={12} color="#E0620B" fill="#E0620B" /> : <Icon name="lock" size={13} color="#8A86A0" />}</i><span className="ell">{a} · {b}</span><small>{fr ? 'ดูฟรี' : c}</small></button>
          })}</div>
          <div className={s.st}>เรียนจบแล้วทำอะไรได้</div>
          {arr(spec.outcomes).map((o) => <Ok key={o}>{o}</Ok>)}
        </>
      )
    }
    case 'font':
      return (
        <>
          {!/สติกเกอร์|ไอคอน/.test(str(spec.sub)) ? <>
            <div className={s.st}>ลองพิมพ์ดู</div>
            <div className={s.spc}><div className={s.spcBig}>{fontText || 'ร้านขนมบ้านพิมพ์ อร่อยทุกคำ ✿'}</div>
              <input className={s.spcIn} value={fontText} onChange={(e) => setFontText(e.target.value)} placeholder="พิมพ์ชื่อร้านคุณเพื่อลองฟอนต์…" /></div>
          </> : <>
            <div className={s.st}>ในชุดนี้มี {str(spec.count)}</div>
            <div className={s.port}>{['0 0', '50% 0', '100% 0', '0 100%'].map((x) => <div key={x} style={{ backgroundImage: `url(${import.meta.env.BASE_URL}img/${g[0]})`, backgroundSize: '300%', backgroundPosition: x }} />)}</div>
          </>}
          <div className={s.st}>ตารางสิทธิ์ตามแบบที่ซื้อ</div>
          <table className={s.lic}><thead><tr><th>ใช้ทำ</th>{opts.map((o) => <th key={o.id}>{o.label}<br />{baht(o.price)}</th>)}</tr></thead>
            <tbody>{[['งานส่วนตัว การบ้าน', 1, 1], ['โพสต์ขายของ โฆษณา', 0, 1], ['โลโก้ ป้ายร้าน', 0, 1], ['สินค้าที่พิมพ์ขาย', 0, 1], ['ขายต่อไฟล์', 0, 0]].map(([a, b, c]) => (
              <tr key={a as string}><td>{a}</td>{opts.map((o, i) => { const y = i === 0 ? b : c; return <td key={o.id} className={y ? s.yes : s.no}>{y ? '✓' : '–'}</td> })}</tr>))}</tbody></table>
        </>
      )
    case 'hire': {
      const o = opts.find((x) => x.id === optId) ?? opts[1]
      return (
        <>
          <div className={s.st}>เลือกแพ็กเกจ</div>
          <div className="seg" style={{ '--n': opts.length, '--i': Math.max(0, opts.findIndex((x) => x.id === o.id)) } as React.CSSProperties}>
            <span className="seg-thumb" />{opts.map((x) => <button key={x.id} className={x.id === o.id ? 'on' : ''} onClick={() => setOptId(x.id)}>{x.label}</button>)}
          </div>
          <div key={o.id} className={`${s.pkb} tab-fade`}>
            <div className={s.pkh}><b>แพ็กเกจ{o.label}</b><strong>{baht(o.price)}</strong></div>
            <div className={s.mt}>{o.sub.split(' · ').map((x) => <span key={x}><Icon name={/วัน/.test(x) ? 'clock' : 'redo'} size={12} color="#D6336C" stroke={2.2} />{x}</span>)}</div>
            {arr(spec.deliverables).map((d) => <Ok key={d}>{d}</Ok>)}
          </div>
          <div className={s.st}>ผลงานที่เคยทำ</div>
          <div className={s.port}>{['mascot.jpg', 'g_tuktuk.jpg', 'toys.jpg'].map((x) => <Img key={x} src={x} />)}</div>
          <div className={s.st}>ขั้นตอนการจ้าง</div>
          <div className={s.stps}>{['ส่งบรีฟ', 'ได้ใบเสนอราคา', 'ชำระ', 'รับงาน'].map((x, i) => <div key={x}><i>{i + 1}</i><span>{x}</span></div>)}</div>
        </>
      )
    }
    case 'free':
      return (
        <>
          <div className={s.scan} style={{ marginTop: 14 }}><Icon name="gift" size={24} color="#16A34A" /><div><b>ดาวน์โหลดฟรี ไม่ต้องจ่าย</b>ครีเอเตอร์แจกให้ใช้ · สแกนไวรัสแล้ว</div></div>
          <div className={s.st}>ชอบไหม? ให้ทิปเป็นกำลังใจ</div>
          <div className={s.tipr}>{[20, 50, 100].map((a) => <button key={a} className="press" onClick={() => onTip(a)}>฿{a}</button>)}<button className="press" onClick={() => onTip(0)}>อื่น ๆ</button></div>
          <p className="hint">ไม่บังคับ ทิปส่งถึงครีเอเตอร์เต็มจำนวน</p>
        </>
      )
    case 'media': {
      const audio = /เพลง|เสียง/.test(str(spec.sub))
      return (
        <>
          <div className={s.st}>ตัวอย่าง{audio ? 'เสียง' : 'คลิป'}</div>
          {audio ? (
            <div className={s.wave}><button className={s.wplay} aria-label="เล่นตัวอย่าง"><Icon name="play" size={18} color="#fff" fill="#fff" /></button>
              <div className={s.wbars}>{Array.from({ length: 42 }, (_, i) => <i key={i} style={{ transform: `scaleY(${0.25 + Math.abs(Math.sin(i * 0.55)) * 0.75})` }} />)}</div><small>0:30</small></div>
          ) : (
            <div className={s.video}><Img src={g[0]} className={s.videoImg} /><span className={s.playBig}><Icon name="play" size={30} color="#fff" fill="#fff" /></span><span className={s.wm}>ตัวอย่างมีลายน้ำ · ไฟล์จริงไม่มี</span></div>
          )}
          <div className={s.scan} style={{ background: '#F5EBFF', color: '#6B21A8' }}><Icon name="shield" size={22} color="#9333EA" /><div><b>ไม่ได้โคลนเสียงหรือหน้าคนจริง</b>ผู้ขายยืนยันแล้ว · สร้างด้วย {str(spec.aiTool)}</div></div>
          <div className={s.st}>สิทธิ์เพลง / เสียง</div>
          <div className={s.box}><div className={s.ok}><Icon name="megaphone" size={15} color="var(--p)" />{str(spec.musicLic)}</div></div>
        </>
      )
    }
    case 'skill':
      return (
        <>
          <div className={s.st}>ใช้กับ AI agent</div>
          <div className={s.cmpt}>{arr(spec.platforms).map((x) => <div key={x}><Icon name="bulb" size={18} color="#0F766E" />{x}<span className={s.yes}>รองรับ</span></div>)}</div>
          <div className={s.st}>ไฟล์ในชุด</div>
          <div className={s.tree}>{arr(spec.contents).map((c) => { const [f, d] = c.split(' — '); return <div key={c}><Icon name="file" size={15} color="#0F766E" /><code>{f}</code><span>{d}</span></div> })}</div>
          <div className={s.st}>ทำให้ agent ทำอะไรได้</div>
          {arr(spec.features).map((f) => <Ok key={f}>{f}</Ok>)}
        </>
      )
    case 'data': {
      const cols = arr(spec.columns).map((c) => c.split(' — '))
      return (
        <>
          <div className={s.st}>ตัวอย่างข้อมูล 3 แถว</div>
          <div className={`hscroll ${s.dtWrap}`}><table className={s.dt}><thead><tr>{cols.map(([k]) => <th key={k}>{k}</th>)}</tr></thead>
            <tbody>{[0, 1, 2].map((r) => <tr key={r}>{cols.map(([k], i) => <td key={k}>{SAMPLE_ROW(k, r, i, cols.some(([c]) => c === 'text'))}</td>)}</tr>)}</tbody></table></div>
          <div className={s.st}>คอลัมน์</div>
          <div className={s.tree}>{cols.map(([k, d]) => <div key={k}><Icon name="hash" size={14} color="#1D4ED8" /><code>{k}</code><span>{d}</span></div>)}</div>
          <div className={s.st}>ที่มาของข้อมูล</div>
          <p className={s.desc}>{str(spec.source)}</p>
          <div className={s.scan}><Icon name="shield" size={22} color="#16A34A" /><div><b>ไม่มีข้อมูลส่วนบุคคล · มีสิทธิ์เผยแพร่</b>ผู้ขายยืนยันแล้ว และ LUMI สุ่มตรวจก่อนเปิดขาย</div></div>
          {filesOf(spec.files).length > 0 && <p className="hint">ไฟล์: {filesOf(spec.files).map((f) => `${f.name} (${f.size})`).join(', ')}</p>}
        </>
      )
    }
  }
}

const ROWS: Record<string, string[]> = {
  name: ['ต้มยำกุ้ง', 'ผัดกะเพราหมู', 'แกงเขียวหวาน'], name_en: ['Tom Yum Goong', 'Pad Kra Pao', 'Green Curry'], category: ['ต้ม', 'ผัด', 'แกง'], kcal: ['310', '580', '420'], spicy: ['3', '2', '2'], price_avg: ['180', '65', '90'],
  text: ['ส่งไว ของตรงปก', 'สีเพี้ยนนิดหน่อย', 'ไม่ประทับใจเลย'], label: ['บวก', 'กลาง', 'ลบ'], stars: ['5', '3', '1'],
}
const SAMPLE_ROW = (k: string, r: number, i: number, rev: boolean) => (rev && k === 'category' ? ['ความงาม', 'แฟชั่น', 'ของใช้'][r] : ROWS[k]?.[r] ?? `ค่า ${r + 1}.${i + 1}`)
