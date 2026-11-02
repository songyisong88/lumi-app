import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Empty, Img, SampleNote, Sheet, TopBar } from '../../components/ui'
import type { CartItem, Order } from '../../data/appTypes'
import { heroOf } from '../../data/productExtras'
import { baht, creatorById, productById } from '../../data/sampleData'
import { COUPONS, cart, checkout, discountOf } from '../../services/api'
import { getDb, useDb } from '../../services/db'
import { toast } from '../../services/toast'
import s from './Shop.module.css'

const itemImg = (c: CartItem) => c.image ?? (productById(c.productId) ? heroOf(productById(c.productId)!) : 'g_lotus.jpg')
const itemTitle = (c: CartItem) => c.title ?? productById(c.productId)?.title ?? 'รายการ'
const itemCreator = (c: CartItem) => c.creatorId ?? productById(c.productId)?.creatorId ?? 'fasai'

function groupBy(items: CartItem[]) {
  const m = new Map<string, CartItem[]>()
  for (const c of items) { const k = itemCreator(c); m.set(k, [...(m.get(k) ?? []), c]) }
  return [...m.entries()]
}

function Lines({ items, removable }: { items: CartItem[]; removable?: boolean }) {
  const [gone, setGone] = useState<string[]>([])
  const remove = (k: string) => { setGone((g) => [...g, k]); setTimeout(() => cart.remove(k), 280) }
  return (
    <>
      {groupBy(items).map(([cid, list]) => {
        const c = creatorById(cid)
        return (
          <div key={cid} className={`${s.grp} rise`}>
            <Link to={`/creator/${cid}`} className={s.gh}><Av src={c.avatar} size={24} />{c.name}<small>{list.length} ชิ้น</small></Link>
            {list.map((it) => (
              <div key={it.key} className={`${s.it} ${gone.includes(it.key) ? 'collapse' : ''}`}>
                <Img src={itemImg(it)} className={s.thumb} />
                <div className={s.im}>
                  {productById(it.productId) ? <Link to={`/product/${it.productId}`}><b className="ell2">{itemTitle(it)}</b></Link> : <b className="ell2">{itemTitle(it)}</b>}
                  <small>{it.productId === 'tip' ? 'ทิปให้ครีเอเตอร์' : it.optionLabel ?? 'ไฟล์ดิจิทัล'} · ได้ทันทีหลังชำระ</small>
                </div>
                <span className={s.ip}>{it.price ? baht(it.price) : 'ฟรี'}</span>
                {removable && <button className={`${s.rm} press`} onClick={() => remove(it.key)} aria-label="ลบออกจากตะกร้า"><Icon name="trash" size={17} /></button>}
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}

export function Cart() {
  const db = useDb()
  const nav = useNavigate()
  const total = db.cart.reduce((a, c) => a + c.price, 0)
  return (
    <div className="has-bar">
      <TopBar title="ตะกร้า" sub={db.cart.length ? `${db.cart.length} ชิ้น` : undefined} />
      <div className="narrow">
        {db.cart.length === 0 ? (
          <Empty icon="cart" title="ตะกร้ายังว่าง" text="ผลงานที่กดใส่ตะกร้าจะอยู่ตรงนี้ ชำระทีเดียวได้หลายร้าน" action={<Link to="/" className="btn btn-p btn-sm" style={{ marginTop: 8 }}>เลือกดูผลงาน</Link>} />
        ) : (
          <>
            <div style={{ padding: '10px 16px 0' }}><SampleNote>โหมดทดลอง · ยังไม่มีการตัดเงินจริง</SampleNote></div>
            <Lines items={db.cart} removable />
            <div className={s.demo}><Icon name="tag" size={18} color="#B45309" /><div><b>มีโค้ดส่วนลด?</b>ใส่ได้ในขั้นตอนชำระเงิน เช่น LUMI10</div></div>
          </>
        )}
      </div>
      {db.cart.length > 0 && (
        <div className="bottom-bar">
          <div className={s.tot}><small>รวม {db.cart.length} ชิ้น</small><b>{baht(total)}</b></div>
          <button className="btn btn-p" onClick={() => nav(`/checkout?keys=${db.cart.map((c) => c.key).join(',')}`)}>ชำระเงิน</button>
        </div>
      )}
    </div>
  )
}

const METHODS = [
  { id: 'promptpay', label: 'พร้อมเพย์ QR', sub: 'สแกนจ่ายด้วยแอปธนาคารไหนก็ได้', icon: 'qr', bg: '#E8F0FB', c: '#0B3A6E' },
  { id: 'card', label: 'บัตรเครดิต / เดบิต', sub: 'Visa, Mastercard, JCB', icon: 'card', bg: '#F3ECFF', c: '#6C2BD9' },
  { id: 'truemoney', label: 'TrueMoney Wallet', sub: 'จ่ายผ่านวอลเล็ต', icon: 'wallet', bg: '#FFF0E6', c: '#E0620B' },
  { id: 'mbank', label: 'โมบายแบงกิ้ง', sub: 'KPlus, SCB Easy, Krungthai NEXT', icon: 'phone', bg: '#E5F8EC', c: '#15803D' },
]

function FakeQR() {
  const cells = useMemo(() => Array.from({ length: 21 * 21 }, (_, i) => {
    const x = i % 21, y = Math.floor(i / 21)
    const finder = (a: number, b: number) => x >= a && x < a + 7 && y >= b && y < b + 7
    if (finder(0, 0) || finder(14, 0) || finder(0, 14)) {
      const lx = x % 14 % 7, ly = y % 14 % 7
      return lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4)
    }
    return ((x * 7 + y * 13 + x * y) % 5) < 2
  }), [])
  return <svg viewBox="0 0 21 21" shapeRendering="crispEdges">{cells.map((on, i) => on && <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" fill="#16132B" />)}</svg>
}

export function Checkout() {
  const [sp] = useSearchParams()
  const db = useDb()
  const keys = (sp.get('keys') ?? '').split(',').filter(Boolean)
  const items = db.cart.filter((c) => keys.includes(c.key))
  const [code, setCode] = useState('')
  const [coupon, setCoupon] = useState<string>()
  const [method, setMethod] = useState('promptpay')
  const [busy, setBusy] = useState(false)
  const [qr, setQr] = useState(false)
  const [order, setOrder] = useState<Order>()
  const sub = items.reduce((a, c) => a + c.price, 0)
  const disc = discountOf(items, coupon)
  const total = sub - disc

  if (order) return <Success order={order} />
  if (!items.length) return (
    <>
      <TopBar title="ชำระเงิน" />
      <Empty icon="receipt" title="ไม่มีรายการให้ชำระ" text="รายการนี้อาจชำระไปแล้ว หรือถูกลบออกจากตะกร้า" action={<Link to="/cart" className="btn btn-o btn-sm" style={{ marginTop: 8 }}>ไปที่ตะกร้า</Link>} />
    </>
  )

  const apply = (c = code) => {
    const k = c.trim().toUpperCase()
    if (!COUPONS[k]) { toast('ไม่พบโค้ดนี้ ลอง LUMI10'); return }
    if (!discountOf(items, k)) { toast('โค้ดนี้ใช้กับรายการในตะกร้าไม่ได้'); return }
    setCoupon(k); setCode(k); toast(`ใช้โค้ด ${k} แล้ว`)
  }
  const place = async () => {
    setQr(false); setBusy(true)
    const o = await checkout.place(keys, total === 0 ? 'ฟรี' : `${METHODS.find((m) => m.id === method)!.label} (ทดลอง)`, coupon)
    setBusy(false); setOrder(o)
  }
  const pay = () => (total > 0 && method === 'promptpay' ? setQr(true) : place())

  return (
    <div className="has-bar">
      <TopBar title="ชำระเงิน" sub={`${items.length} รายการ`} />
      <div className="narrow">
        <div className={s.demo}><Icon name="shield" size={18} color="#B45309" /><div><b>โหมดทดลอง ไม่มีการตัดเงินจริง</b>ใช้ทดสอบขั้นตอนเท่านั้น ไม่ต้องกรอกข้อมูลบัตรจริง</div></div>
        <Lines items={items} />
        {total > 0 || coupon ? (
          <>
            <div className={s.h}>โค้ดส่วนลด</div>
            <div className={s.blk}>
              <div className={s.cp}><input className="inp" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ใส่โค้ด" aria-label="โค้ดส่วนลด" /><button className="btn btn-d" style={{ height: 46 }} onClick={() => apply()}>ใช้โค้ด</button></div>
              {coupon ? <div className={`${s.cpok} pop-in`}><Icon name="check" size={16} color="#16A34A" stroke={2.6} />{COUPONS[coupon].label} · ลด {baht(disc)}<button className="btn btn-xs btn-o" style={{ marginLeft: 'auto' }} onClick={() => { setCoupon(undefined); setCode('') }}>เอาออก</button></div>
                : <div className={s.cps}>{Object.entries(COUPONS).map(([k, c]) => <button key={k} className="chip" onClick={() => apply(k)}><Icon name="tag" size={13} />{k} · {c.label}</button>)}</div>}
            </div>
            <div className={s.h}>วิธีชำระเงิน</div>
            <div className={s.blk}>
              {METHODS.map((m) => (
                <button key={m.id} className={`opt ${s.pm} ${method === m.id ? 'on' : ''}`} onClick={() => setMethod(m.id)}>
                  <span className="radio" />
                  <span className={s.pmi} style={{ background: m.bg }}><Icon name={m.icon} size={20} color={m.c} /></span>
                  <span><b>{m.label}</b><small>{m.sub}</small></span>
                  <span className="pill pill-w">ทดลอง</span>
                </button>
              ))}
              {method === 'card' && <div className={`card2 tab-fade ${s.card}`} style={{ marginTop: 10 }}>
                <div className="hint" style={{ margin: 0 }}>บัตรทดสอบ (กรอกให้แล้ว ไม่ต้องใช้บัตรจริง)</div>
                <input className="inp" value="4242 4242 4242 4242" readOnly aria-label="เลขบัตรทดสอบ" />
                <div className={s.row2}><input className="inp" value="12/30" readOnly aria-label="วันหมดอายุ" /><input className="inp" value="•••" readOnly aria-label="CVV" /></div>
              </div>}
            </div>
          </>
        ) : null}
        <div className={s.sum}>
          <div><span>ราคาสินค้า</span><span>{baht(sub)}</span></div>
          {disc > 0 && <div className={s.disc}><span>ส่วนลด {coupon}</span><span>−{baht(disc)}</span></div>}
          <div><span>ค่าธรรมเนียม</span><span>฿0</span></div>
          <div className={s.grand}><span>ยอดชำระ</span><span>{baht(total)}</span></div>
        </div>
        <p className="hint" style={{ margin: '10px 16px 0' }}>ไฟล์ คีย์ และลิงก์ จะส่งเข้าแชตกับครีเอเตอร์ทันทีหลังชำระ · งานจ้าง LUMI พักเงินไว้จนกว่าคุณจะกดรับงาน</p>
      </div>
      <div className="bottom-bar">
        <div className={s.tot}><small>ยอดชำระ</small><b>{baht(total)}</b></div>
        <button className="btn btn-p" onClick={pay} disabled={busy} style={{ minWidth: 150 }}>{busy ? <><span className={s.spin} />กำลังชำระ…</> : total === 0 ? 'รับฟรีเลย' : 'ชำระเงิน (ทดลอง)'}</button>
      </div>
      <Sheet open={qr} onClose={() => setQr(false)} title="สแกนจ่ายด้วยพร้อมเพย์" sub="QR ตัวอย่าง สแกนไม่ได้จริง"
        footer={<><button className="btn btn-o" onClick={() => setQr(false)}>ยกเลิก</button><button className="btn btn-p" style={{ flex: 1 }} onClick={place}>จำลองว่าโอนแล้ว</button></>}>
        <div className={s.qr}>
          <div className={s.qrBox}><FakeQR /><span className={s.qrLogo}>PromptPay</span></div>
          <b style={{ fontSize: 22 }}>{baht(total)}</b>
          <span className={s.timer}>ชำระภายใน 14:59 นาที · ร้าน LUMI Marketplace (ตัวอย่าง)</span>
        </div>
      </Sheet>
      {busy && <div className="sheet-back open" style={{ zIndex: 200 }} />}
    </div>
  )
}

function Success({ order }: { order: Order }) {
  const nav = useNavigate()
  const bought = getDb().purchases.filter((p) => p.orderNo === order.no)
  const hireThread = order.items.find((i) => i.offerThreadId)?.offerThreadId
  const tipOnly = order.items.every((i) => i.productId === 'tip')
  const thread = hireThread ?? bought[0]?.threadId ?? getDb().threads[0]?.id
  return (
    <div>
      <TopBar back={false} title="" right={<button className="tb-btn" onClick={() => nav('/', { replace: true })} aria-label="ปิด"><Icon name="x" size={22} /></button>} />
      <div className="narrow">
        <div className={s.done}>
          <span className={`${s.bigOk} pop-in`}><Icon name="check" size={44} color="#fff" stroke={3} /></span>
          <h1>{order.total === 0 ? 'รับฟรีเรียบร้อย!' : tipOnly ? 'ส่งทิปแล้ว ขอบคุณค่ะ!' : 'ชำระเงินสำเร็จ!'}</h1>
          <p>{hireThread ? 'LUMI พักเงินไว้ให้ ครีเอเตอร์เริ่มงานได้แล้ว ติดตามงานได้ในแชต' : tipOnly ? 'ทิปส่งถึงครีเอเตอร์เต็มจำนวน (ทดลอง)' : 'ไฟล์ คีย์ และลิงก์ส่งเข้าแชตกับครีเอเตอร์แล้ว เปิดได้ตลอดจากโปรไฟล์ > ที่ซื้อแล้ว'}</p>
        </div>
        <div className={`${s.rcp} rise`}>
          <div><span>เลขออเดอร์</span><b>#{order.no}</b></div>
          <div><span>รายการ</span><b>{order.items.length} ชิ้น</b></div>
          {order.discount > 0 && <div><span>ส่วนลด</span><b style={{ color: '#15803D' }}>−{baht(order.discount)}</b></div>}
          <div><span>ยอดชำระ</span><b>{baht(order.total)}</b></div>
          <div><span>ช่องทาง</span><b>{order.method}</b></div>
        </div>
        <div className={s.acts}>
          {thread && <button className="btn btn-p btn-block" onClick={() => nav(`/chat/${thread}`, { replace: true })}><Icon name="chat" size={18} color="#fff" />{hireThread ? 'ไปที่แชตงานจ้าง' : 'เปิดไฟล์ในแชต'}</button>}
          <button className="btn btn-o btn-block" onClick={() => nav('/profile?tab=bought', { replace: true })}>ดูที่ซื้อแล้ว</button>
          <button className="btn btn-s btn-block" onClick={() => nav('/', { replace: true })}>เลือกซื้อต่อ</button>
        </div>
        <SampleNote>ออเดอร์ตัวอย่าง · ไม่มีการตัดเงินจริง</SampleNote>
      </div>
    </div>
  )
}
