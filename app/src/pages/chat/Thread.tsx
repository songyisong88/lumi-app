import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Empty, Img, Sheet, Stars, TopBar, copyText, blockTap } from '../../components/ui'
import { IssueSheet, issueOpen } from '../../components/OrderHelp'
import { ReportSheet } from '../../components/Report'
import { HIRE_STEPS, type Message, type Thread as T } from '../../data/appTypes'
import { heroOf } from '../../data/productExtras'
import { ALL_PRODUCTS, ME, baht, creatorById, productById } from '../../data/sampleData'
import { chat, orders } from '../../services/api'
import { useDb } from '../../services/db'
import { toast } from '../../services/toast'
import { clock, dayLabel } from '../../utils/time'
import { fileToDataUrl } from '../../utils/image'
import s from './Chat.module.css'

const STICKERS = ['🙏', '😊', '💜', '👍', '🎉', '🥰', '😂', '🔥', '✨', '🐶', '🌸', '☕']
const STEP_DESC = ['คุณส่งรายละเอียดงานให้ครีเอเตอร์', 'ครีเอเตอร์เสนอราคาและสิ่งที่จะได้รับ', 'ชำระผ่านผู้ให้บริการชำระเงินแล้ว ยังไม่โอนให้ครีเอเตอร์', 'ครีเอเตอร์กำลังทำงานและอัปเดตความคืบหน้า', 'ตรวจงาน ขอแก้ได้ตามจำนวนครั้งในแพ็กเกจ', 'กดรับงานแล้ว (หรือครบ 3 วันหลังส่งงาน) เงินโอนให้ครีเอเตอร์']

export function Thread() {
  const { id = '' } = useParams()
  const db = useDb()
  const nav = useNavigate()
  const t = db.threads.find((x) => x.id === id)
  const msgs = db.messages[id] ?? []
  const [text, setText] = useState('')
  const [sheet, setSheet] = useState<'menu' | 'files' | 'track' | 'attach' | 'sticker' | 'product' | 'offer' | 'issue' | 'late' | 'report' | null>(null)
  const [review, setReview] = useState<Message>()
  const [revise, setRevise] = useState<Message>()
  const scroller = useRef<HTMLDivElement>(null)
  const first = useRef(msgs.length)
  const imgIn = useRef<HTMLInputElement>(null)
  const fileIn = useRef<HTMLInputElement>(null)

  useEffect(() => { if (t?.unread) chat.markRead(id) }, [id, t?.unread])
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 240
    if (near || msgs.at(-1)?.from === 'me' || first.current === msgs.length) el.scrollTo({ top: el.scrollHeight, behavior: first.current === msgs.length ? 'auto' : 'smooth' })
  }, [msgs.length])

  if (!t) return <><TopBar title="แชต" /><Empty icon="chat" title="ไม่พบแชตนี้" action={<Link to="/chat" className="btn btn-o btn-sm">กลับไปที่แชต</Link>} /></>
  const c = creatorById(t.partnerId)
  const bought = t.role === 'creator' && !t.hire ? db.purchases.find((x) => x.threadId === id && x.price > 0 && !x.issue && issueOpen(x.at)) : undefined
  const lib = t.role === 'creator' ? db.purchases.filter((x) => x.threadId === id) : []
  const hirePaid = t.role === 'creator' && t.hire && (t.step ?? 0) >= 2 && (t.step ?? 0) < 5 && !!t.amount && !t.issue
  const p = t.productId ? productById(t.productId) : undefined
  const send = (v = text) => { const x = v.trim(); if (!x) return; chat.send(id, x); setText('') }
  const typing = msgs.some((m) => m.kind === 'typing')
  const assets = msgs.filter((m) => m.kind === 'key' || m.kind === 'file' || m.kind === 'coupon' || (m.kind === 'delivery' && m.status === 'accepted'))
  const pay = async (m: Message) => { const k = await chat.payOffer(id, m.id); nav(`/checkout?keys=${k}`) }

  const pickImage = async (f?: File) => {
    if (!f) return
    const url = await fileToDataUrl(f, 640)
    setSheet(null)
    chat.sendCard(id, { kind: 'text', text: '', image: url })
  }
  const pickFile = (f?: File) => {
    if (!f) return
    setSheet(null)
    chat.sendCard(id, { kind: 'file', fileName: f.name, size: `${(f.size / 1048576).toFixed(1)} MB` })
  }

  let lastDay = ''
  return (
    <div className={s.th}>
      <TopBar
        title={<Link to={`/creator/${c.id}`} className={s.who}><Av src={c.avatar} size={36} online={t.online} /><span><b className="ell">{c.name}</b><small>{typing ? 'กำลังพิมพ์…' : t.online ? 'ออนไลน์อยู่' : 'ออนไลน์ล่าสุด 2 ชม.'}</small></span></Link>}
        right={<button className="tb-btn" onClick={() => setSheet('menu')} aria-label="เมนูแชต"><Icon name="dots" size={22} /></button>}
      />
      {(p || t.orderNo) && (
        <button className={`${s.strip} press`} onClick={() => (t.hire ? setSheet('track') : p && nav(`/product/${p.id}`))}>
          <Img src={t.image ?? (p && heroOf(p))} className={s.sImg} />
          <span className={s.sm}>
            <b className="ell">{t.title}</b>
            <small>{t.orderNo ? `#${t.orderNo} · ` : ''}{t.amount ? baht(t.amount) : p ? baht(p.price) : ''} · <em className={s[`e_${t.tone}`]}>{t.status}</em></small>
            {t.hire && <span className={s.steps} aria-label={`ขั้นที่ ${(t.step ?? 0) + 1} จาก ${HIRE_STEPS.length}`}>{HIRE_STEPS.map((x, i) => <i key={x} className={i < (t.step ?? 0) ? s.sd : i === t.step ? s.sc : ''} />)}</span>}
          </span>
          <Icon name="chev" size={18} color="var(--mut)" />
        </button>
      )}
      <div ref={scroller} className={s.msgs}>
        <div className={s.safe}><Icon name="shield" size={14} color="#15803D" />{t.hire ? 'ชำระผ่านผู้ให้บริการชำระเงินที่มีใบอนุญาต · เงินโอนให้ครีเอเตอร์เมื่อคุณกดรับงาน หรือครบ 3 วันหลังส่งงาน' : 'คุยผ่าน LUMI เท่านั้น · อย่าโอนเงินนอกแอป'} · แชตตัวอย่าง</div>
        {msgs.map((m, i) => {
          const d = dayLabel(m.at)
          const showDay = d !== lastDay
          lastDay = d
          const fresh = i >= first.current
          return (
            <Fragment key={m.id}>
              {showDay && <div className={s.day}><span>{d}</span></div>}
              <Bubble m={m} t={t} fresh={fresh} onPay={pay} onReview={setReview} onRevise={setRevise} />
            </Fragment>
          )
        })}
      </div>

      {t.role === 'customer' && t.hire && t.status.includes('รอคุณส่งไฟล์') && (
        <div className={s.act}><Icon name="bolt" size={16} color="#B45309" />ลูกค้าชำระแล้ว ส่งไฟล์งานได้เลย<button className="btn btn-xs btn-p" onClick={() => chat.deliverToCustomer(id)}>ส่งไฟล์งาน</button></div>
      )}
      <div className={s.cmp}>
        {t.quick.length > 0 && <div className={`hscroll ${s.quick}`}>{t.quick.map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}</div>}
        <div className={s.bar}>
          <button className={s.cb} onClick={() => setSheet('attach')} aria-label="แนบ"><Icon name="plus" size={22} stroke={2.2} /></button>
          <div className={s.inw}>
            <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }} placeholder="พิมพ์ข้อความ…" aria-label="ข้อความ" />
            <button onClick={() => setSheet('sticker')} aria-label="สติกเกอร์"><Icon name="smile" size={20} color="var(--mut)" /></button>
          </div>
          <button className={`${s.send} ${text.trim() ? s.sendOn : ''}`} onClick={() => send()} aria-label="ส่ง" {...blockTap(!text.trim(), 'พิมพ์ข้อความก่อนส่ง')}><Icon name="back" size={20} color="#fff" stroke={2.4} /></button>
        </div>
      </div>
      <input ref={imgIn} type="file" accept="image/*" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
      <input ref={fileIn} type="file" hidden onChange={(e) => pickFile(e.target.files?.[0])} />

      {/* ⋯ menu */}
      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title={c.name}>
        <div className={s.menu}>
          <button className="list-row" onClick={() => setSheet('files')}><Icon name="key" size={20} color="var(--p)" /><span className="grow">ไฟล์และคีย์<small>ไฟล์ คีย์ใช้งาน ลิงก์ และคูปองในแชตนี้</small></span><span className="badge-n" style={{ background: 'var(--p)' }}>{assets.length}</span></button>
          {t.hire && <button className="list-row" onClick={() => setSheet('track')}><Icon name="target" size={20} />ติดตามงานจ้าง</button>}
          {p && <button className="list-row" onClick={() => { setSheet(null); nav(`/product/${p.id}`) }}><Icon name="store" size={20} />ดูหน้าผลงาน</button>}
          <button className="list-row" onClick={() => { setSheet(null); nav(`/creator/${c.id}`) }}><Icon name="user" size={20} />ดูโปรไฟล์ {c.name}</button>
          <button className="list-row" onClick={() => { chat.setFlag(id, 'pinned'); setSheet(null) }}><Icon name="pin" size={20} />{t.pinned ? 'เลิกปักหมุด' : 'ปักหมุดแชต'}</button>
          <button className="list-row" onClick={() => { chat.setFlag(id, 'muted'); setSheet(null) }}><Icon name="eyeoff" size={20} />{t.muted ? 'เปิดการแจ้งเตือน' : 'ปิดการแจ้งเตือน'}</button>
          {(bought || hirePaid) && <button className="list-row" style={{ color: '#DC2626' }} onClick={() => setSheet('issue')}><Icon name="receipt" size={20} color="#DC2626" />แจ้งปัญหา / ขอคืนเงิน</button>}
          <button className="list-row" style={{ color: '#DC2626' }} onClick={() => setSheet('report')}><Icon name="flag" size={20} color="#DC2626" />รายงาน {c.name}</button>
        </div>
      </Sheet>

      {/* C: files & keys */}
      <Sheet open={sheet === 'files'} onClose={() => setSheet(null)} title="ไฟล์และคีย์" sub={`จากแชตกับ ${c.name}`} tall>
        {lib.length > 0 && <Link to={lib.length === 1 ? `/library/${lib[0].id}` : '/library'} className="list-row" style={{ margin: '0 -16px 8px', width: 'calc(100% + 32px)' }} data-thread-library><Icon name="box" size={20} color="var(--p)" /><span className="grow"><b>เปิดคลังของที่ซื้อ</b><small>ไฟล์ คีย์ ลิงก์ ใบเสร็จ ของ {lib.length} รายการจากแชตนี้</small></span><Icon name="chev" size={16} color="var(--mut)" /></Link>}
        {assets.length === 0 ? (lib.length ? null : <Empty icon="file" title="ยังไม่มีไฟล์หรือคีย์" text="หลังชำระเงิน ไฟล์และคีย์จะอยู่ในคลังของที่ซื้อ · แนะนำให้ดาวน์โหลดเก็บไว้" />) : (
          <div className={s.assets}>
            {(['key', 'file', 'delivery', 'coupon'] as const).map((k) => {
              const list = assets.filter((m) => m.kind === k)
              if (!list.length) return null
              return (
                <div key={k}>
                  <div className={s.ah}>{{ key: 'คีย์และพรอมต์', file: 'ไฟล์', delivery: 'งานที่รับแล้ว', coupon: 'คูปอง' }[k]}</div>
                  {list.map((m) => <Asset key={m.id} m={m} />)}
                </div>
              )
            })}
            <p className="hint" style={{ textAlign: 'center' }}>ไฟล์ผ่านการสแกนไวรัสเบื้องต้น ไม่พบภัยที่รู้จัก · ไฟล์ตัวอย่าง</p>
          </div>
        )}
      </Sheet>

      {/* B: hire tracker */}
      <Sheet open={sheet === 'track'} onClose={() => setSheet(null)} title="ติดตามงานจ้าง" sub={t.orderNo ? `ออเดอร์ #${t.orderNo}` : t.title} tall>
        <div className={s.track}>
          {HIRE_STEPS.map((x, i) => {
            const st = i < (t.step ?? 0) ? 'd' : i === t.step ? 'c' : 'u'
            return (
              <div key={x} className={`${s.tk} ${s['tk_' + st]}`}>
                <i>{st === 'd' ? <Icon name="check" size={13} color="#fff" stroke={3} /> : i + 1}</i>
                <div><b>{x}{st === 'c' && <span className="pill pill-p" style={{ marginLeft: 6 }}>ตอนนี้</span>}</b><small>{STEP_DESC[i]}</small></div>
              </div>
            )
          })}
        </div>
        <div className={s.escrow}><Icon name="shield" size={22} color="#15803D" /><div><b>{t.amount ? baht(t.amount) : (t.step ?? 0) >= 1 ? 'งานฟรี' : 'รอใบเสนอราคา'} · {!t.amount && (t.step ?? 0) >= 1 ? 'ไม่ต้องชำระเงิน' : (t.step ?? 0) >= 2 && (t.step ?? 0) < 5 ? 'ชำระแล้ว · โอนให้ครีเอเตอร์เมื่อคุณกดรับงาน' : (t.step ?? 0) >= 5 ? 'โอนให้ครีเอเตอร์แล้ว' : 'ยังไม่ชำระ'}</b>{!t.amount && (t.step ?? 0) >= 1 ? 'งานฟรีไม่มีการชำระเงิน · คุย ตรวจงาน และกดรับงานในแชตนี้ได้เลย' : 'ถ้าครีเอเตอร์ไม่ส่งงานตามกำหนด ขอเงินคืนได้เต็มจำนวน · ถ้าไม่ขอแก้หรือแจ้งปัญหาภายใน 3 วันหลังส่งงาน เงินโอนให้ครีเอเตอร์อัตโนมัติ (ตัวอย่าง)'}</div></div>
      {hirePaid && (t.step ?? 0) < 4 && <button className="btn btn-o btn-block" style={{ marginTop: 12, color: '#DC2626' }} onClick={() => setSheet('late')}>ครีเอเตอร์ส่งช้าเกินกำหนด? ขอยกเลิกและคืนเงิน</button>}
        {t.issue && <p className="hint" style={{ marginTop: 10, color: '#B91C1C' }}>แจ้งปัญหาแล้ว: {t.issue.reason} · {t.issue.status}</p>}
      </Sheet>

      {/* attach */}
      <Sheet open={sheet === 'attach'} onClose={() => setSheet(null)} title="ส่งอะไรดี">
        <div className={s.attach}>
          {[
            { ic: 'image', l: 'รูปภาพ', bg: '#EAF1FF', c: '#2563EB', f: () => imgIn.current?.click() },
            { ic: 'file', l: 'ไฟล์', bg: '#F3ECFF', c: '#6C2BD9', f: () => fileIn.current?.click() },
            { ic: 'store', l: 'ผลงานของฉัน', bg: '#FDEBF2', c: '#DB2777', f: () => setSheet('product') },
            { ic: 'smile', l: 'สติกเกอร์', bg: '#FFF4DB', c: '#B45309', f: () => setSheet('sticker') },
            ...(t.role === 'customer' ? [{ ic: 'receipt', l: 'ใบเสนอราคา', bg: '#E5F8EC', c: '#15803D', f: () => setSheet('offer') }] : []),
          ].map((a, i) => <button key={a.l} className="rise" style={{ '--i': i } as React.CSSProperties} onClick={a.f}><span style={{ background: a.bg }}><Icon name={a.ic} size={24} color={a.c} /></span>{a.l}</button>)}
        </div>
        <p className="hint">ไฟล์ที่แนบเก็บไว้ในเครื่องนี้เท่านั้น ไม่ได้อัปโหลดหรือส่งถึงใคร (ตัวอย่าง)</p>
      </Sheet>
      <Sheet open={sheet === 'sticker'} onClose={() => setSheet(null)} title="สติกเกอร์">
        <div className={s.stk}>{STICKERS.map((e) => <button key={e} className="press" onClick={() => { setSheet(null); chat.sendCard(id, { kind: 'sticker', text: e }) }}>{e}</button>)}</div>
      </Sheet>
      <Sheet open={sheet === 'product'} onClose={() => setSheet(null)} title="แชร์ผลงานของฉัน" tall>
        {ALL_PRODUCTS.filter((x) => x.creatorId === ME).map((x) => (
          <button key={x.id} className="list-row" onClick={() => { setSheet(null); chat.sendCard(id, { kind: 'product', productId: x.id }) }}>
            <Img src={heroOf(x)} style={{ width: 48, height: 48, borderRadius: 10, flex: 'none' }} /><span className="grow"><b className="ell" style={{ display: 'block' }}>{x.title}</b><small>{x.price ? baht(x.price) : 'ฟรี'}</small></span><Icon name="chev" size={18} color="var(--mut)" />
          </button>
        ))}
      </Sheet>
      <IssueSheet open={sheet === 'issue' || sheet === 'late'} onClose={() => setSheet(null)} purchaseId={bought?.id} threadId={bought ? undefined : id} hire={!bought} preset={sheet === 'late' ? 'ส่งงานช้าเกินกำหนด · ขอยกเลิกและคืนเงิน' : undefined} />
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} target="creator" id={c.id} />
      <OfferSheet open={sheet === 'offer'} onClose={() => setSheet(null)} thread={t} />
      <ReviewSheet m={review} onClose={() => setReview(undefined)} onDone={(st, r) => { chat.acceptDelivery(id, review!.id, st, r); setReview(undefined); toast('รับงานแล้ว ขอบคุณสำหรับรีวิว') }} />
      <ReviseSheet m={revise} onClose={() => setRevise(undefined)} onDone={(n) => { chat.requestRevision(id, revise!.id, n); setRevise(undefined) }} />
    </div>
  )
}

function Asset({ m }: { m: Message }) {
  if (m.kind === 'key' || m.kind === 'coupon') return (
    <div className={s.as}><span className={s.asi} style={{ background: m.kind === 'key' ? '#F3ECFF' : '#FFF4DB' }}><Icon name={m.kind === 'key' ? 'key' : 'gift'} size={18} color={m.kind === 'key' ? '#6C2BD9' : '#B45309'} /></span>
      <span className="grow"><b className="ell">{m.title}</b><code className="ell">{m.code}</code></span>
      <button className="btn btn-xs btn-s" onClick={() => { copyText(m.code ?? ''); toast('คัดลอกแล้ว') }}><Icon name="copy" size={14} />คัดลอก</button></div>
  )
  return (
    <div className={s.as}><span className={s.asi} style={{ background: '#EAF1FF' }}><Icon name={m.kind === 'delivery' ? 'image' : 'file'} size={18} color="#2563EB" /></span>
      <span className="grow"><b className="ell">{m.fileName ?? m.title}</b><small>{m.size ?? 'ไฟล์งานฉบับเต็ม'} · <span style={{ color: '#15803D' }}>สแกนเบื้องต้นแล้ว</span></small></span>
      <button className="btn btn-xs btn-s" onClick={() => toast('ไฟล์ตัวอย่าง · ดาวน์โหลดไฟล์จริงได้เมื่อเปิดระบบเก็บไฟล์')}><Icon name="download" size={14} />โหลด</button></div>
  )
}

function Bubble({ m, t, fresh, onPay, onReview, onRevise }: { m: Message; t: T; fresh: boolean; onPay: (m: Message) => void; onReview: (m: Message) => void; onRevise: (m: Message) => void }) {
  const mine = m.from === 'me'
  const cls = `${s.b} ${mine ? s.me : s.them} ${fresh ? 'bubble-in' : ''}`
  const time = <span className={s.tm}>{clock(m.at)}</span>
  switch (m.kind) {
    case 'typing': return <div className={`${s.b} ${s.them} bubble-in`}><div className={s.typing}><i /><i /><i /></div></div>
    case 'system': return <div className={`${s.sys} ${fresh ? 'bubble-in' : ''}`}><Icon name="shield" size={13} color="#15803D" /><span className="grow">{m.text}{m.link && <Link to={m.link} className={s.sysLink} data-sys-link>{m.linkLabel ?? 'เปิด'} ›</Link>}</span></div>
    case 'sticker': return <div className={cls}><div className={s.sticker}>{m.text}</div>{time}</div>
    case 'text': return <div className={cls}>{m.image && <Img src={m.image} className={s.pic} sizes="75vw" />}{m.text && <div className={s.tx}>{m.text}</div>}{time}</div>
    case 'product': {
      const p = productById(m.productId ?? '')
      if (!p) return null
      return <div className={cls}><Link to={`/product/${p.id}`} className={`${s.card} ${s.pc} press`}><Img src={heroOf(p)} className={s.pcImg} /><span><b className="ell2">{p.title}</b><small>{p.price ? baht(p.price) : 'ฟรี'} · ดูผลงาน ›</small></span></Link>{time}</div>
    }
    case 'brief': return (
      <div className={cls}><div className={`${s.card} ${s.brief}`}><div className={s.ch}><Icon name="file" size={16} color="var(--p)" />{m.title}</div><ul>{m.items?.map((x) => <li key={x}>{x}</li>)}</ul></div>{time}</div>
    )
    case 'offer': {
      const paid = (t.step ?? 0) >= 3
      return (
        <div className={cls}><div className={`${s.card} ${s.offer}`}>
          <div className={s.ch}><Icon name="receipt" size={16} color="#15803D" />{m.title}</div>
          <div className={s.amt}>{m.amount ? baht(m.amount) : 'ฟรี'}</div>
          <ul>{m.items?.map((x) => <li key={x}><Icon name="check" size={13} color="#16A34A" stroke={2.6} />{x}</li>)}</ul>
          {mine ? <div className={s.state}>{m.status === 'accepted' ? 'ลูกค้ารับข้อเสนอแล้ว' : 'รอลูกค้าตอบรับ'}</div>
            : m.status === 'pending' ? <div className={s.btns}><button className="btn btn-sm btn-o" onClick={() => chat.send(t.id, 'ขอคุยรายละเอียดเพิ่มก่อนนะครับ')}>ขอคุยเพิ่ม</button><button className="btn btn-sm btn-p" onClick={() => chat.acceptOffer(t.id, m.id)}>{m.amount ? 'รับข้อเสนอ' : 'รับข้อเสนอ (ฟรี)'}</button></div>
            : m.status === 'accepted' && !m.amount ? <div className={s.state}><Icon name="check" size={14} color="#16A34A" stroke={2.6} />งานฟรี · ไม่ต้องชำระเงิน</div>
            : m.status === 'accepted' && !paid ? <button className="btn btn-sm btn-p btn-block" onClick={() => onPay(m)}>ชำระเงิน {baht(m.amount ?? 0)} (ทดลอง)</button>
            : <div className={s.state}><Icon name="check" size={14} color="#16A34A" stroke={2.6} />ชำระแล้ว · โอนให้ครีเอเตอร์เมื่อรับงาน</div>}
        </div>{time}</div>
      )
    }
    case 'progress': return (
      <div className={cls}><div className={s.card}><div className={s.ch}><Icon name="clock" size={16} color="#2563EB" />{m.title}</div>{m.image && <Img src={m.image} className={s.pic} sizes="75vw" />}<p className={s.ctx}>{m.text}</p>
        <div className={s.pbar}><i style={{ transform: `scaleX(${(m.pct ?? 0) / 100})` }} /></div><small className={s.ps}>เสร็จแล้ว {m.pct}%</small></div>{time}</div>
    )
    case 'delivery': return (
      <div className={cls}><div className={`${s.card} ${s.dlv}`}><div className={s.ch}><Icon name="box" size={16} color="#B45309" />{m.title}</div>
        <div className={s.wmw}><Img src={m.image} className={s.pic} sizes="75vw" />{m.status !== 'accepted' && <span className={s.wm}>LUMI · ตัวอย่างมีลายน้ำ</span>}</div>
        <p className={s.ctx}>{m.text}</p>
        {m.status === 'pending' && !mine ? <>
          <small className={s.ps}>ขอแก้ได้อีก {m.left} ครั้ง · ตรวจงานภายใน {m.extended ? '6 วัน (ขยายแล้ว)' : '3 วัน'}{!m.extended && <> · <button className={s.lnk} onClick={() => orders.extendReview(t.id, m.id)}>ขอเวลาตรวจเพิ่ม 3 วัน</button></>}</small>
          <div className={s.btns}><button className="btn btn-sm btn-o" {...blockTap(!m.left, 'ใช้สิทธิ์ขอแก้ไขครบแล้ว · คุยกับครีเอเตอร์ในแชตได้')} onClick={() => onRevise(m)}>ขอแก้ไข</button><button className="btn btn-sm btn-p" onClick={() => onReview(m)}>รับงาน</button></div>
        </> : <div className={s.state}>{m.status === 'accepted' ? <><Icon name="check" size={14} color="#16A34A" stroke={2.6} />รับงานแล้ว</> : m.status === 'revise' ? 'ขอแก้ไขแล้ว' : 'รอลูกค้าตรวจ'}</div>}
      </div>{time}</div>
    )
    case 'key': return <div className={cls}><div className={`${s.card} ${s.key}`}><div className={s.ch}><Icon name="key" size={16} color="#6C2BD9" />{m.title}</div><code>{m.code}</code><button className="btn btn-xs btn-s" onClick={() => { copyText(m.code ?? ''); toast('คัดลอกแล้ว') }}><Icon name="copy" size={14} />คัดลอก</button></div>{time}</div>
    case 'file': return <div className={cls}><div className={`${s.card} ${s.file}`}><span className={s.asi} style={{ background: '#EAF1FF' }}><Icon name="file" size={18} color="#2563EB" /></span><span className="grow"><b className="ell">{m.fileName}</b><small>{m.size} · สแกนเบื้องต้นแล้ว</small></span><button className={s.dl} onClick={() => toast('ไฟล์ตัวอย่าง · ดาวน์โหลดไฟล์จริงได้เมื่อเปิดระบบเก็บไฟล์')} aria-label="ดาวน์โหลด"><Icon name="download" size={18} /></button></div>{time}</div>
    case 'tip': return <div className={cls}><div className={`${s.card} ${s.tip}`}><Icon name="coin" size={22} color="#B45309" /><span><b>ให้ทิป {baht(m.amount ?? 0)}</b><small>{m.text}</small></span></div>{time}</div>
    case 'coupon': return <div className={cls}><div className={`${s.card} ${s.cpn}`}><Icon name="gift" size={22} color="#DB2777" /><span className="grow"><b>{m.title}</b><code>{m.code}</code></span><button className="btn btn-xs btn-p" onClick={() => { copyText(m.code ?? ''); toast(`คัดลอกโค้ด ${m.code} แล้ว ใช้ตอนชำระเงิน`) }}>เก็บโค้ด</button></div>{time}</div>
  }
}

function OfferSheet({ open, onClose, thread }: { open: boolean; onClose: () => void; thread: T }) {
  const [amount, setAmount] = useState('')
  const [items, setItems] = useState('ไฟล์ความละเอียดสูง\nแก้ไขได้ 2 ครั้ง\nส่งงานภายใน 3 วัน')
  const ok = Number(amount) > 0 && items.trim()
  return (
    <Sheet open={open} onClose={onClose} title="ส่งใบเสนอราคา" sub={thread.title}
      footer={<button className="btn btn-p btn-block" {...blockTap(!ok, 'ใส่ราคาและสิ่งที่ลูกค้าจะได้รับก่อนส่ง')} onClick={() => { chat.sendCard(thread.id, { kind: 'offer', title: 'ใบเสนอราคา', amount: Number(amount), items: items.split('\n').filter((x) => x.trim()), status: 'pending' }); onClose(); setAmount('') }}>ส่งใบเสนอราคา</button>}>
      <div className="field"><label className="flabel">ราคา (บาท)<span className="req">*</span></label><input className="inp" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="เช่น 900" /></div>
      <div className="field"><label className="flabel">สิ่งที่ลูกค้าจะได้รับ<span className="req">*</span></label><textarea className="ta" rows={4} value={items} onChange={(e) => setItems(e.target.value)} /><p className="hint">บรรทัดละ 1 รายการ · LUMI หัก 10% เมื่อปิดงาน (ตัวอย่าง · ยังไม่รวม VAT และค่าธรรมเนียมการชำระเงิน)</p></div>
    </Sheet>
  )
}

function ReviewSheet({ m, onClose, onDone }: { m?: Message; onClose: () => void; onDone: (stars: number, text: string) => void }) {
  const [st, setSt] = useState(5)
  const [r, setR] = useState('')
  return (
    <Sheet open={!!m} onClose={onClose} title="รับงานและรีวิว" sub="เมื่อกดรับงาน LUMI จะโอนเงินให้ครีเอเตอร์"
      footer={<button className="btn btn-p btn-block" onClick={() => onDone(st, r.trim())}>ยืนยันรับงาน</button>}>
      <div className={s.rate}>{[1, 2, 3, 4, 5].map((i) => <button key={i} onClick={() => setSt(i)} aria-label={`${i} ดาว`} className={i <= st ? 'heart-pop' : ''}><Icon name="star" size={36} stroke={0} color="none" fill={i <= st ? '#F5A524' : '#E4E1EC'} /></button>)}</div>
      <p style={{ textAlign: 'center', marginBottom: 10 }}><Stars v={st} /> {['', 'ต้องปรับปรุง', 'พอใช้', 'ดี', 'ดีมาก', 'ประทับใจมาก'][st]}</p>
      <textarea className="ta" rows={3} value={r} onChange={(e) => setR(e.target.value)} placeholder="เล่าให้คนอื่นฟังหน่อย งานเป็นอย่างไรบ้าง (ไม่บังคับ)" />
    </Sheet>
  )
}

function ReviseSheet({ m, onClose, onDone }: { m?: Message; onClose: () => void; onDone: (note: string) => void }) {
  const [n, setN] = useState('')
  return (
    <Sheet open={!!m} onClose={onClose} title="ขอแก้ไขงาน" sub={m ? `เหลือขอแก้ได้อีก ${m.left} ครั้ง` : ''}
      footer={<button className="btn btn-p btn-block" {...blockTap(n.trim().length < 4, 'เล่าสิ่งที่อยากให้แก้อย่างน้อย 4 ตัวอักษร')} onClick={() => { onDone(n.trim()); setN('') }}>ส่งคำขอแก้ไข</button>}>
      <div className="chips" style={{ flexWrap: 'wrap', marginBottom: 10 }}>{['ขอปรับสีให้สว่างขึ้น', 'ขอตัวหนังสือใหญ่ขึ้น', 'ขอเปลี่ยนท่าทาง'].map((x) => <button key={x} className="chip" onClick={() => setN(x)}>{x}</button>)}</div>
      <textarea className="ta" rows={4} value={n} onChange={(e) => setN(e.target.value)} placeholder="อยากให้แก้ตรงไหน อธิบายให้ชัดที่สุด" />
    </Sheet>
  )
}
