import { useEffect, useMemo, useRef, useState } from 'react'
import { FollowButton } from '../../components/FollowButton'
import { Link, useNavigate } from 'react-router-dom'
import { HeartButton } from '../../components/HeartButton'
import { Icon } from '../../components/Icon'
import { Av, copyText, Img, Sheet, Stars, blockTap } from '../../components/ui'
import { licRows, layoutOf, sellTypeOf, specOf, SPECS, str, arr, on, filesOf } from '../../data/listingSpec'
import { galleryOf, highlightsOf, optionsOf, pageContent, REVIEWS, reviewer, similarOf, statsOf, creatorStats } from '../../data/productExtras'
import { baht, creatorById, isRemoteId, ME } from '../../data/sampleData'
import { loadReviews } from '../../services/cloud'
import { ago } from '../../utils/time'
import type { Product } from '../../data/types'
import { cart, chat, checkout } from '../../services/api'
import { getDb, useDb } from '../../services/db'
import { toast } from '../../services/toast'
import { settle } from '../../services/backClose'
import { Modules } from './modules'
import { WriteReviewSheet } from '../../components/OrderHelp'
import { ReportSheet } from '../../components/Report'
import { replyToReview, sell } from '../../services/api'
import { FEATURES, REAL, BRAND } from '../../config'
import { ModBanner } from '../../components/ModStatus'
import { catLabel } from '../../data/searchData'
import { openFromCard } from '../../components/ProductCard'
import { useDetailGestures } from '../../hooks/useDetailGestures'
import { setSlideIn, swipeContext } from '../../services/motion'
import s from './Product.module.css'

type Sec = 'over' | 'get' | 'how' | 'rev' | 'sim'
const SECS: { v: Sec; label: string }[] = [
  { v: 'over', label: 'ภาพรวม' }, { v: 'get', label: 'ได้อะไรบ้าง' }, { v: 'how', label: 'วิธีใช้' }, { v: 'rev', label: 'รีวิว' }, { v: 'sim', label: 'คล้ายกัน' },
]

/** Cheapest one-off option (monthly plans only if nothing else). Shown first so the page matches card prices. */
const cheapest = <T extends { price: number; suffix?: string }>(os: T[]): T | undefined => {
  const pool = os.filter((o) => !o.suffix).length ? os.filter((o) => !o.suffix) : os
  return pool.reduce<T | undefined>((m, o) => (!m || o.price < m.price ? o : m), undefined)
}

export function ProductView({ p, preview }: { p: Product; preview?: boolean }) {
  const nav = useNavigate()
  const db = useDb()
  const L = layoutOf(p)
  const t = sellTypeOf(p)
  const spec = specOf(p)
  const pc = pageContent(p)
  const opts = optionsOf(p)
  // once bought, open on the option that was paid for so page price = library/order price
  const [optId, setOptId] = useState(() => { const ow = db.purchases.find((x) => x.productId === p.id); return ((ow && opts.find((o) => o.price === ow.price)) ?? cheapest(opts))?.id })
  const opt = opts.find((o) => o.id === optId) ?? opts[0]
  const c = creatorById(p.creatorId)
  const cs = creatorStats(p.creatorId, db.follows.includes(p.creatorId))
  const st = statsOf(p)
  const gallery = galleryOf(p)
  const owned = db.purchases.find((x) => x.productId === p.id)
  const [replyTo, setReplyToRaw] = useState<{ key: string; who: string } | null>(null)
  const [replyText, setReplyText] = useState('')
  const setReplyTo = (x: { key: string; who: string; text?: string } | null) => { if (x) setReplyText(x.text ?? db.replies?.[x.key] ?? ''); setReplyToRaw(x) }
  // real listings: real reviews (and creator replies) from the server instead of the sample ones
  const real = isRemoteId(p.id) && !preview
  useEffect(() => { if (real) void loadReviews(p.id).catch(() => {}) }, [real, p.id])
  const cr = real ? (db.cloudReviews?.[p.id] ?? []).filter((r) => !(owned?.review && r.authorId === ME)) : []
  const all = real ? (db.cloudReviews?.[p.id] ?? []) : []
  // Pinterest motion: zoom from the card, swipe down back into it, swipe sideways through the list it came from
  const heroRef = useRef<HTMLDivElement>(null)
  const ctxIds = swipeContext()?.ids ?? []
  const at = ctxIds.indexOf(`p:${p.id}`)
  const neighbour = (d: 1 | -1) => (at >= 0 ? ctxIds[at + d]?.slice(2) : undefined)
  useDetailGestures(heroRef, {
    zoomKey: `p:${p.id}`, disabled: preview, target: () => heroRef.current,
    onClose: () => ((window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/', { replace: true })),
    hasNeighbour: (d) => !!neighbour(d),
    onSwipe: (d) => { const n = neighbour(d); if (!n) return false; setSlideIn(d); nav(`/product/${n}`, { replace: true }); return true },
  })
  const crAvg = all.length ? Math.round((all.reduce((a, r) => a + r.stars, 0) / all.length) * 10) / 10 : 0
  const crBars = [5, 4, 3, 2, 1].map((n) => [n, all.length ? Math.round((all.filter((r) => r.stars === n).length / all.length) * 100) : 0])
  const [myRev, setMyRev] = useState(false)
  const mine = p.creatorId === ME
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState<null | 'brief' | 'tip' | 'free' | 'trial' | 'lesson' | 'share' | 'sendto' | 'added' | 'manage' | 'report'>(null)
  const root = useRef<HTMLDivElement>(null)
  const [sec, setSec] = useState<Sec>('over')
  const [solid, setSolid] = useState(false)
  const [slide, setSlide] = useState(0)

  // scrollspy + solid header on the page's own scroll layer
  useEffect(() => {
    const el = root.current?.closest('.lsc') as HTMLElement | null
    if (!el) return
    const on = () => {
      setSolid(el.scrollTop > 220)
      let cur: Sec = 'over'
      for (const x of SECS) {
        const n = root.current?.querySelector<HTMLElement>(`[data-sec="${x.v}"]`)
        if (n && n.getBoundingClientRect().top < 160) cur = x.v
      }
      setSec(cur)
    }
    el.addEventListener('scroll', on, { passive: true })
    return () => el.removeEventListener('scroll', on)
  }, [])
  const jump = (v: Sec) => {
    const el = root.current?.closest('.lsc') as HTMLElement | null
    const n = root.current?.querySelector<HTMLElement>(`[data-sec="${v}"]`)
    if (el && n) el.scrollTo({ top: n.offsetTop - 104, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  const [tipAmt, setTipAmt] = useState(50)
  const inCart = db.cart.filter((c) => !c.direct).length
  const guard = () => { if (preview) { toast('นี่คือตัวอย่างหน้าผลงาน ปุ่มยังกดซื้อไม่ได้'); return true } return false }
  const addToCart = async (go: boolean) => {
    if (guard()) return
    const key = await cart.add({ productId: p.id, optionId: opt?.id, optionLabel: opt?.label, price: opt?.price ?? p.price, creatorId: p.creatorId, direct: go })
    if (go) nav(`/checkout?keys=${key}`)
    else setSheet('added')
  }
  const openChat = async () => {
    if (guard()) return
    const id = await chat.openWith(p.creatorId, p.id)
    nav(`/chat/${id}`)
  }
  const getFree = async () => {
    if (guard()) return
    setBusy(true)
    const key = await cart.add({ productId: p.id, price: 0, creatorId: p.creatorId, optionLabel: 'ของฟรี', direct: true })
    await checkout.place([key], 'ฟรี')
    setBusy(false)
    setSheet('free')
  }

  const price = L === 'free' ? 0 : opt?.price ?? p.price
  const freeHire = L === 'hire' && p.price === 0
  const ebook = t === 'course' && str(spec.sub) === 'อีบุ๊ก'
  const freeLessons = t === 'course' && str(spec.freeLessons) !== 'ไม่มี'
  // previews of visual / audio work carry a LUMI watermark until bought (files themselves are clean)
  const marked = !mine && !owned && !preview && L !== 'free' && ['img', 'font', 'media', 'tpl'].includes(t)
  const similar = useMemo(() => similarOf(p), [p])

  // bottom bar per layout (approved product-b “bar”)
  const bar = (() => {
    if (mine && !preview) return { sub: 'ผลงานของคุณ', main: <button className="btn btn-d" onClick={() => setSheet('manage')}>จัดการผลงาน</button>, sec: <button className="btn btn-o btn-sm" onClick={() => setSheet('share')}><Icon name="share" size={16} />แชร์</button> }
    if (owned && L !== 'hire') return { sub: `${owned.price ? 'ซื้อแล้ว' : 'รับฟรีแล้ว'}${owned.optionLabel && owned.optionLabel !== 'ของฟรี' ? ` · ${owned.optionLabel}` : ''}`, main: <button className="btn btn-p" onClick={() => nav(`/library/${owned.id}`)}><Icon name="download" size={18} color="#fff" />เปิดในคลังของที่ซื้อ</button>, sec: null }
    switch (L) {
      case 'free': return { sub: 'ของฟรี', main: <button className="btn btn-p" disabled={busy} onClick={getFree}>{busy ? 'กำลังเตรียมไฟล์…' : 'ดาวน์โหลดฟรี'}</button>, sec: FEATURES.tips ? <button className="btn btn-o btn-sm" onClick={() => (guard() ? null : setSheet('tip'))}><Icon name="gift" size={16} color="#B45309" />ให้ทิป</button> : null }
      case 'hire': return { sub: freeHire ? 'รับงานฟรี' : `แพ็กเกจ${opt?.label ?? ''}`, main: <button className="btn btn-p" onClick={() => (guard() ? null : setSheet('brief'))}>{freeHire ? 'ส่งบรีฟขอรับงานฟรี' : 'ส่งบรีฟขอใบเสนอราคา'}</button>, sec: <button className="btn btn-o btn-sm" onClick={openChat} aria-label="แชตถามก่อน" title="แชตถามก่อน"><Icon name="chat" size={18} color="var(--p)" /></button> }
      default: {
        const second = L === 'sw' && on(spec.trial) ? <button className="btn btn-o btn-sm" onClick={async () => {
          if (guard()) return
          const tid = await chat.openWith(p.creatorId, p.id)
          await chat.sendCard(tid, { kind: 'file', fileName: `${p.title.replace(/\s+/g, '-')}-ทดลอง-${str(spec.trialDays).replace(/\s+/g, '')}.zip`, size: '12 MB' }, 'them')
          toast(`ส่งตัวทดลอง ${str(spec.trialDays)} ในแชตแล้ว`); nav(`/chat/${tid}`)
        }}><Icon name="play" size={15} color="var(--p)" />ทดลอง</button>
          : L === 'bot' && on(spec.trial) ? <button className="btn btn-o btn-sm" onClick={() => setSheet('trial')}><Icon name="qr" size={16} color="var(--p)" />ลองฟรี</button>
            : L === 'course' && freeLessons ? <button className="btn btn-o btn-sm" onClick={() => setSheet('lesson')}><Icon name={ebook ? 'book' : 'play'} size={15} color="var(--p)" />{ebook ? 'อ่านตัวอย่าง' : 'ตอนแรกฟรี'}</button>
              : <button className={s.cartBtn} onClick={() => addToCart(false)} aria-label="เพิ่มลงตะกร้า"><Icon name="cart" size={21} /></button>
        return { sub: opt?.label ?? '', main: <button className="btn btn-p" onClick={() => addToCart(true)}>{L === 'course' ? (ebook ? 'ซื้ออีบุ๊ก' : 'ซื้อคอร์ส') : 'ซื้อเลย'}</button>, sec: second }
      }
    }
  })()

  return (
    <div ref={root} className={`${s.page} ${preview ? '' : 'has-bar'}`}>
      {/* header: transparent over the hero, turns solid on scroll */}
      <header className={`${s.ph} ${solid ? s.solid : ''}`}>
        <button className={s.hb} onClick={() => (preview ? null : (window.history.state?.idx ?? 0) > 0 ? nav(-1) : nav('/'))} aria-label="ย้อนกลับ" style={preview ? { visibility: 'hidden' } : undefined}><Icon name="back" size={22} stroke={2.2} /></button>
        <div className={s.ht}>{p.title}</div>
        <button className={s.hb} onClick={() => setSheet('share')} aria-label="แชร์"><Icon name="share" size={20} /></button>
        {!preview && !mine && <button className={s.hb} onClick={() => setSheet('report')} aria-label="รายงานผลงานนี้"><Icon name="flag" size={19} /></button>}
        {!preview && <Link to="/cart" className={s.hb} aria-label={inCart > 0 ? `ตะกร้า ${inCart} ชิ้น` : 'ตะกร้า'}><Icon name="cart" size={20} />{inCart > 0 && <span className={s.cnt}>{inCart}</span>}</Link>}
      </header>

      {/* gallery */}
      <div className={s.hero} ref={heroRef}>
        <div className={`hscroll ${s.slides}`} onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
          {gallery.map((g, i) => <div key={g + i} className={s.slideW}><Img src={g} className={s.slide} sizes="100vw" eager={i === 0} />{marked && <span className={s.wm} data-wm aria-hidden>{Array.from({ length: 6 }, (_, k) => <i key={k}>{BRAND} · ตัวอย่าง</i>)}</span>}</div>)}
        </div>
        <div className={s.tyb}><span><Icon name={SPECS[t].icon} size={13} color="#fff" stroke={2.2} />{catLabel(p)}{L === 'free' || freeHire ? ' · ฟรี' : ''}</span>{marked && <span>ภาพตัวอย่างมีลายน้ำ</span>}{p.mine && <span>ผลงานของคุณ</span>}</div>
        {!preview && <HeartButton productId={p.id} className={s.fav} />}
        {gallery.length > 1 && <div className={s.dots}>{gallery.map((_, i) => <i key={i} className={i === slide ? s.don : ''} />)}</div>}
      </div>

      <div className={s.pd}>
        {!preview && mine && <ModBanner id={p.id} />}
        <h1 className={s.ttl}>{p.title}</h1>
        <div className={s.rt}><Icon name="star" size={13} stroke={0} fill="#F5A524" /><b>{st.reviews ? st.rating : 'ใหม่'}</b>{st.reviews > 0 && <span>({st.reviews} รีวิว)</span>}<span>·</span><span>{st.soldLabel}</span></div>
        <div className={s.pr}>
          {L === 'free' || freeHire ? <span className={s.free}>{freeHire ? 'รับงานฟรี' : 'ฟรี'}</span> : <>{L === 'hire' && <small>ราคาเริ่มต้น</small>}{L !== 'hire' && !owned && opts.length > 1 && <small>เริ่ม</small>}<b data-head-price>{baht(L === 'hire' ? Math.min(...opts.map((o) => o.price)) : owned ? owned.price : cheapest(opts)?.price ?? price)}{L === 'hire' ? '' : owned ? '' : cheapest(opts)?.suffix ?? ''}</b>{owned && L !== 'hire' && <small>{owned.price ? 'ซื้อแล้ว' : 'รับแล้ว'}</small>}{L === 'hire' && <small data-quote-note>· ราคาจริงตามใบเสนอราคา</small>}</>}
        </div>
        <p className={s.use}><Icon name="target" size={14} color="var(--mut)" />{p.use}</p>
        <div className={s.hl}>
          {highlightsOf(p).map(([ic, a, b]) => <div key={a}><Icon name={ic} size={18} color="var(--p)" />{a}<b>{b || '-'}</b></div>)}
        </div>
      </div>

      <nav className={`hscroll ${s.tabs}`} aria-label="ส่วนของหน้า">
        {SECS.map((x) => <button key={x.v} className={sec === x.v ? s.ton : ''} onClick={() => jump(x.v)}>{x.label}</button>)}
      </nav>

      <div className={s.pd}>
        <section data-sec="over">
          {opts.length > 0 && L !== 'free' && L !== 'hire' && (
            <>
              <div className={s.st}>{L === 'sw' ? 'เลือกสิทธิ์ใช้งาน' : 'เลือกแบบที่ต้องการ'}</div>
              {opts.map((o) => (
                <button key={o.id} className={`opt ${o.id === opt?.id ? 'on' : ''}`} onClick={() => setOptId(o.id)}>
                  <span className="radio" />
                  <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: 'block', fontSize: 14.5 }}>{o.label}</b><small className="muted">{o.sub}</small></span>
                  <b>{baht(o.price)}{o.suffix ?? ''}</b>
                  {o.best && <span className={s.best}>{o.best}</span>}
                </button>
              ))}
            </>
          )}
          <Modules unlocked={(mine && !preview) || !!owned} p={p} L={L} spec={spec} opts={opts} optId={opt?.id} setOptId={setOptId} onTip={(a) => { if (guard()) return; setTipAmt(a ?? 50); setSheet('tip') }} onTrial={() => setSheet('trial')} onLesson={() => setSheet('lesson')} />
          {p.desc && <><div className={s.st}>รายละเอียด</div><p className={s.desc}>{p.desc}</p></>}
          {pc.facts.length > 0 && <div className={s.spec} style={{ marginTop: 14 }}>{pc.facts.map(([k, v]) => <div key={k}>{k}<b>{v}</b></div>)}</div>}
        </section>

        <section data-sec="get">
          <div className={s.st}>สิ่งที่คุณจะได้รับ</div>
          <div className={s.box}>{pc.deliver.map((d, i) => <div key={i} className={s.ok}><span className="ok-ic"><Icon name="check" size={13} stroke={3} /></span>{d}</div>)}</div>
          {filesOf(spec.files).length > 0 && (
            <div className={s.scan}><Icon name="shield" size={22} color="#16A34A" /><div><b>สแกนไวรัสเบื้องต้นแล้ว ไม่พบภัยที่รู้จัก</b>{filesOf(spec.files).length} ไฟล์ · ผ่านการตรวจโดยทีม {BRAND} ก่อนขึ้นขาย · ถ้าพบว่าผิดกฎภายหลัง {BRAND} ลบได้</div></div>
          )}
          {L !== 'free' && !freeHire && <div className={s.scan} style={{ background: '#EEF2FF', color: '#3730A3' }}><Icon name="lock" size={22} color="#4F46E5" /><div><b>ชำระผ่านผู้ให้บริการชำระเงินที่มีใบอนุญาต</b>{L === 'hire' || t === 'hire' ? 'เงินโอนให้ครีเอเตอร์เมื่อคุณกดรับงาน หรือครบ 3 วันหลังส่งงานถ้าไม่ได้ขอแก้หรือแจ้งปัญหา' : 'ไฟล์มีปัญหาหรือไม่ตรงคำอธิบาย กดแจ้งปัญหา / ขอคืนเงินได้ภายใน 7 วัน ก่อนเงินโอนให้ครีเอเตอร์'}</div></div>}
        </section>

        <section data-sec="how">
          <div className={s.st}>วิธีใช้งาน</div>
          <ol className={s.steps}>{pc.howto.map((h, i) => <li key={i}><i>{i + 1}</i><span>{h}</span></li>)}</ol>
          {pc.needs.length > 0 && <>
            <div className={s.st}>สิ่งที่ต้องมี</div>
            <div className={s.box}>{pc.needs.map((n, i) => <div key={i} className={s.ok}><span className="no-ic"><Icon name="bulb" size={13} /></span>{n}</div>)}</div>
          </>}
          {pc.lic && (
            <>
              <div className={s.st}>สิทธิ์การใช้งาน</div>
              <table className={s.lic}><thead><tr><th>ใช้ทำ</th><th>ได้ไหม</th></tr></thead>
                <tbody>{licRows(t).map((r) => <tr key={r}><td>{r}</td><td className={pc.lic!.includes(r) ? s.yes : s.no}>{pc.lic!.includes(r) ? '✓ ได้' : '–'}</td></tr>)}</tbody></table>
              <p className="hint" style={{ marginTop: 8 }}>สิทธิ์ใช้งานนี้ไม่ผูกขาด ครีเอเตอร์ยังขายให้คนอื่นได้ · งานที่สร้างด้วย AI อาจได้รับความคุ้มครองลิขสิทธิ์ไม่เต็มที่ · ผู้ขายรับรองว่ามีสิทธิ์ขายงานนี้</p>
            </>
          )}
          {(pc.refund || pc.support) && (
            <div className={s.terms}>
              {pc.refund && <div><Icon name="refresh" size={16} color="var(--p)" /><span><b>คืนเงิน</b>{pc.refund}</span></div>}
              {pc.support && <div><Icon name="chat" size={16} color="var(--p)" /><span><b>ซัพพอร์ต</b>{pc.support}</span></div>}
            </div>
          )}
        </section>

        <div className={s.st}>ครีเอเตอร์</div>
        <div className={s.cr}>
          <Av src={c.avatar} size={48} />
          <div className={s.crm}><b>{c.name}<span className={s.vb}><Icon name="check" size={10} color="#fff" stroke={3} /></span></b><small>{cs.rating ? `★ ${cs.rating.toFixed(1)} · ` : ''}ผู้ติดตาม {cs.followersLabel}</small></div>
          {!mine && <button className={s.crc} onClick={openChat} aria-label="แชต"><Icon name="chat" size={18} /></button>}
          {!mine && <FollowButton id={p.creatorId} guard={guard} />}
        </div>

        <section data-sec="rev">
          <div className={s.st}>รีวิว{st.reviews ? ` (${st.reviews})` : ''}</div>
          {owned && !preview && (owned.review ? (
            <div className={s.rv} data-my-review>
              <div className={s.rvh}><Av src={reviewer(ME).avatar} size={26} />รีวิวของคุณ<span className="pill pill-g" style={{ marginLeft: 6 }}>ซื้อแล้ว</span><button className="btn btn-xs btn-o" style={{ marginLeft: 'auto' }} onClick={() => setMyRev(true)}>แก้ไข</button></div>
              <Stars v={owned.review.stars} />{owned.review.text && <p>{owned.review.text}</p>}
            </div>
          ) : (
            <button className="list-row" style={{ width: '100%', border: '1px dashed var(--line)', borderRadius: 12, marginBottom: 10 }} onClick={() => setMyRev(true)}><Icon name="star" size={20} color="#F5A524" /><span className="grow">คุณซื้อผลงานนี้แล้ว · เขียนรีวิว<small>ช่วยให้คนอื่นตัดสินใจง่ายขึ้น</small></span><Icon name="chev" size={16} color="var(--mut)" /></button>
          ))}
          {real ? (all.length === 0 ? <p className="muted" style={{ fontSize: 13.5 }}>ยังไม่มีรีวิว · รีวิวจะขึ้นเมื่อมีคนซื้อและให้คะแนน</p> : (
            <>
              <div className={s.rvs}><div><div className={s.big}>{crAvg}</div><Stars v={crAvg} /></div>
                <div className={s.bars}>{crBars.map(([n, w]) => <div key={n}>{n}<i><b style={{ transform: `scaleX(${w / 100})` }} /></i></div>)}</div></div>
              {cr.map((r) => (
                <div key={r.id} className={s.rv} data-cloud-review>
                  <div className={s.rvh}><Av src={reviewer(r.authorId).avatar} size={26} />{reviewer(r.authorId).name}<span className="pill pill-g" style={{ marginLeft: 6 }}>ซื้อแล้ว</span><small>{ago(r.at)}</small></div>
                  <Stars v={r.stars} />{r.text && <p>{r.text}</p>}
                  {r.reply && <div className={s.rvReply} data-review-reply><b>คำตอบจากครีเอเตอร์</b>{r.reply}</div>}
                  {mine && <button className={`btn btn-xs btn-s ${s.rvBtn}`} onClick={() => setReplyTo({ key: `review:${r.id}`, who: reviewer(r.authorId).name, text: r.reply ?? '' })} data-reply-review>{r.reply ? 'แก้คำตอบ' : 'ตอบรีวิว'}</button>}
                </div>
              ))}
            </>
          )) : st.reviews === 0 ? <p className="muted" style={{ fontSize: 13.5 }}>ยังไม่มีรีวิว · รีวิวจะขึ้นเมื่อมีคนซื้อและให้คะแนน</p> : (
            <>
              <div className={s.rvs}><div><div className={s.big}>{st.rating}</div><Stars v={st.rating} /></div>
                <div className={s.bars}>{[[5, 86], [4, 10], [3, 3], [2, 1], [1, 0]].map(([n, w]) => <div key={n}>{n}<i><b style={{ transform: `scaleX(${w / 100})` }} /></i></div>)}</div></div>
              {REVIEWS.map((r, i) => (
                <div key={i} className={s.rv}>
                  <div className={s.rvh}><Av src={reviewer(r.who).avatar} size={26} />{reviewer(r.who).name}<span className="pill pill-g" style={{ marginLeft: 6 }}>ซื้อแล้ว</span><small>{r.when}</small></div>
                  <Stars v={r.stars} /><p>{r.text}</p>
                  {r.pic && <Img src={gallery[0]} className={s.rvpic} />}
                  {db.replies?.[`${p.id}:${i}`] && <div className={s.rvReply} data-review-reply><b>คำตอบจากครีเอเตอร์</b>{db.replies[`${p.id}:${i}`]}</div>}
                  {mine && !preview && <button className={`btn btn-xs btn-s ${s.rvBtn}`} onClick={() => setReplyTo({ key: `${p.id}:${i}`, who: reviewer(r.who).name })} data-reply-review>{db.replies?.[`${p.id}:${i}`] ? 'แก้คำตอบ' : 'ตอบรีวิว'}</button>}
                </div>
              ))}
            </>
          )}
        </section>

        <section data-sec="sim">
          <div className={s.st}>ผลงานคล้ายกัน</div>
          <div className={s.sim}>
            {similar.map((x) => (
              <Link key={x.id} to={`/product/${x.id}`} className={`${s.simc} press`} onClick={(e) => (preview ? e.preventDefault() : openFromCard(e.currentTarget, x.id))}>
                <Img src={galleryOf(x)[0]} className={s.simi} />
                <b className="ell2">{x.title}</b><small>{creatorById(x.creatorId).name} · {x.price ? baht(x.price) : 'ฟรี'}</small>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {!preview && (
        <div className={`bottom-bar ${s.bar}`}>
          <div className={s.pp}><small>{bar.sub}</small><b style={L === 'free' || freeHire ? { color: '#16A34A' } : undefined}>{owned && L !== 'hire' ? (owned.price ? baht(owned.price) : 'ฟรี') : L === 'free' || freeHire ? 'ฟรี' : `${baht(price)}${opt?.suffix ?? ''}`}</b></div>
          {bar.sec}
          {bar.main}
        </div>
      )}

      {/* sheets */}
      <Sheet open={!!replyTo} onClose={() => setReplyTo(null)} title={`ตอบรีวิวของ ${replyTo?.who ?? ''}`} sub="คำตอบแสดงใต้รีวิวให้ทุกคนเห็น · สุภาพ ไม่ใส่ข้อมูลติดต่อนอกแอป"
        footer={<button className="btn btn-p btn-block" onClick={async () => { if (!replyTo) return; await replyToReview(replyTo.key, replyText); setReplyTo(null); toast(replyText.trim() ? 'ตอบรีวิวแล้ว' : 'ลบคำตอบแล้ว') }}>{replyText.trim() ? 'ส่งคำตอบ' : 'ลบคำตอบ'}</button>}>
        <textarea className="inp" rows={4} maxLength={500} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="ขอบคุณสำหรับรีวิว…" aria-label="คำตอบรีวิว" style={{ height: 'auto', padding: 12 }} data-reply-input />
      </Sheet>
      {owned && <WriteReviewSheet open={myRev} onClose={() => setMyRev(false)} purchaseId={owned.id} initial={owned.review} />}
      <BriefSheet open={sheet === 'brief'} onClose={() => setSheet(null)} p={p} opts={opts} optId={opt?.id} setOptId={setOptId} />
      <TipSheet open={sheet === 'tip'} onClose={() => setSheet(null)} p={p} initial={tipAmt} />
      <Sheet open={sheet === 'added'} onClose={() => setSheet(null)} title="เพิ่มลงตะกร้าแล้ว" sub={`${p.title} · ${opt?.label ?? ''}`}
        footer={<><button className="btn btn-o" style={{ flex: 1 }} onClick={() => setSheet(null)}>ดูต่อ</button><button className="btn btn-p" style={{ flex: 1 }} onClick={() => { setSheet(null); nav('/cart') }}>ไปที่ตะกร้า ({inCart})</button></>}>
        <div className={s.addedRow}><Img src={gallery[0]} className={s.addedImg} /><div><b className="ell2">{p.title}</b><small className="muted">{opt?.label}</small></div><b>{baht(opt?.price ?? p.price)}</b></div>
      </Sheet>
      <Sheet open={sheet === 'free'} onClose={() => setSheet(null)} title="ได้รับแล้ว 🎉" sub="ไฟล์อยู่ในคลังของที่ซื้อแล้ว · เปิดโหลดซ้ำได้จากคลังของที่ซื้อ · แนะนำให้ดาวน์โหลดเก็บไว้"
        footer={<>{FEATURES.tips && <button className="btn btn-o" style={{ flex: 1 }} onClick={() => { setSheet(null); setSheet('tip') }}>ให้ทิป</button>}<button className="btn btn-p" style={{ flex: 1 }} data-open-library onClick={() => { const b = getDb().purchases.find((x) => x.productId === p.id); setSheet(null); nav(b ? `/library/${b.id}` : '/library') }}>เปิดคลังของที่ซื้อ</button></>}>
        <div className={s.box}>{pc.deliver.slice(0, 4).map((d, i) => <div key={i} className={s.ok}><span className="ok-ic"><Icon name="check" size={13} stroke={3} /></span>{d}</div>)}</div>
      </Sheet>
      <Sheet open={sheet === 'trial'} onClose={() => setSheet(null)} title={`ทดลองฟรี ${str(spec.trialDays)}`} sub="สแกนด้วยมือถือเพื่อเปิดในแอป (ตัวอย่าง)">
        <div className={s.trialBox}><Icon name="qr" size={150} stroke={1.4} /><code>{str(spec.trialLink) || 'line.me/R/ti/p/@lumi-demo'}</code>
          <button className="btn btn-s btn-sm" onClick={() => { copyText(str(spec.trialLink)); toast('คัดลอกลิงก์แล้ว') }}><Icon name="copy" size={15} />คัดลอกลิงก์</button>
          <p className="muted" style={{ fontSize: 12.5 }}>ลิงก์ตัวอย่าง ยังไม่ได้เชื่อมบอทจริง</p></div>
      </Sheet>
      <Sheet open={sheet === 'lesson'} onClose={() => setSheet(null)} title={arr(spec.lessons)[0]?.split(' · ').slice(0, 2).join(' · ') ?? 'ตอนแรกฟรี'} sub={ebook ? 'อ่านฟรี ไม่ต้องซื้อ' : 'ดูฟรี ไม่ต้องซื้อ'}>
        {ebook ? <div className={s.box}>{arr(spec.lessons).slice(0, 3).map((l, i) => <div key={i} className={s.ok}><span className="ok-ic"><Icon name="book" size={13} /></span>{l}</div>)}</div>
          : <div className={s.video} role="button" tabIndex={0} aria-label="เล่นวิดีโอตอนแรก" onClick={() => toast('วิดีโอจริงจะเล่นได้เมื่อเชื่อมระบบเก็บไฟล์ (ข้อมูลตัวอย่าง)')}><Img src={gallery[0]} className={s.videoImg} sizes="100vw" /><span className={s.playBig}><Icon name="play" size={30} color="#fff" fill="#fff" /></span><div className={s.vbar}><i /></div></div>}
        <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{ebook ? 'ตัวอ่านตัวอย่าง · หน้าจริงจะเปิดหลังเชื่อมระบบเก็บไฟล์' : 'ตัวเล่นวิดีโอตัวอย่าง · วิดีโอจริงจะเปิดหลังเชื่อมระบบเก็บไฟล์'}</p>
      </Sheet>
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} target="product" id={p.id} />
      <Sheet open={sheet === 'manage'} onClose={() => setSheet(null)} title="จัดการผลงาน" sub={`${p.title} · ${p.price === 0 ? 'แจกฟรี' : `ขาย ${baht(p.price)}`}`}>
        <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>
          <button className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setSheet(null); nav(`/sell?edit=${p.id}&step=2`) }}><Icon name="edit" size={20} color="var(--p)" /><span className="grow">แก้ไขรายละเอียด<small>ชื่อ ภาพ ไฟล์ และข้อมูลทั้งหมด</small></span><Icon name="chev" size={18} /></button>
          {(!FEATURES.launch || t === 'hire') && <button className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setSheet(null); nav(`/sell?edit=${p.id}&step=3`) }}><Icon name={p.price === 0 || t === 'hire' ? 'tag' : 'gift'} size={20} color="var(--p)" /><span className="grow">{t === 'hire' ? 'เปลี่ยนราคาแพ็กเกจ' : p.price === 0 ? 'เปลี่ยนเป็นขาย (ตั้งราคา)' : 'เปลี่ยนราคา หรือเปลี่ยนเป็นแจกฟรี'}<small>{t === 'hire' ? 'งานจ้างต้องมีราคา · งานที่รับไปแล้วใช้ราคาเดิม' : 'สลับฟรีหรือขายได้ทุกเมื่อ · ผู้ที่ได้ไปแล้วยังใช้ได้ตามเดิม'}</small></span><Icon name="chev" size={18} /></button>}
          <button className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setSheet(null); nav('/profile?mode=creator') }}><Icon name="store" size={20} color="var(--p)" /><span className="grow">ไปหน้าจัดการร้าน<small>ยอดขาย ร่าง และผลงานทั้งหมด</small></span><Icon name="chev" size={18} /></button>
          {p.mine && <button className="list-row" style={{ width: '100%', textAlign: 'left', color: '#DC2626' }} onClick={async () => { setSheet(null); await settle(); await sell.unpublish(p.id); toast('เลิกขายแล้ว · ผู้ที่ซื้อไปแล้วยังเปิดไฟล์ได้'); nav('/profile?mode=creator', { replace: true }) }}><Icon name="trash" size={20} color="#DC2626" /><span className="grow">เลิกขายผลงานนี้<small>ซ่อนจากหน้าร้าน ฟีด และหน้าค้นหา</small></span></button>}
        </div>
      </Sheet>
      <Sheet open={sheet === 'share'} onClose={() => setSheet(null)} title="แชร์ผลงานนี้">
        <div className={s.shareRow}>
          {[['link', 'คัดลอกลิงก์'], ['chat', `ส่งในแชต ${BRAND}`], ['users', 'โพสต์ลงชุมชน']].map(([ic, l]) => (
            <button key={l} onClick={() => {
              if (preview) { toast('ตัวอย่างก่อนลงขาย · แชร์ได้หลังลงขาย'); setSheet(null); return }
              if (l === 'คัดลอกลิงก์') { copyText(`${location.origin}${location.pathname}#/product/${p.id}`); toast('คัดลอกลิงก์แล้ว'); setSheet(null) }
              else if (l === `ส่งในแชต ${BRAND}`) setSheet('sendto')
              else { setSheet(null); nav(`/community/new?tag=${p.id}`) }
            }}><span><Icon name={ic} size={22} color="var(--p)" /></span>{l}</button>
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === 'sendto'} onClose={() => setSheet(null)} title="ส่งให้ใครดี" sub="ส่งลิงก์ผลงานนี้ในแชต">
        {db.threads.length === 0 ? <p className="muted">ยังไม่มีแชต เริ่มคุยกับครีเอเตอร์ได้จากหน้าผลงาน</p>
          : <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>{db.threads.map((t) => {
            const who = creatorById(t.partnerId)
            return <button key={t.id} className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => {
              chat.send(t.id, `แนะนำผลงานนี้ “${p.title}” ${location.origin}${location.pathname}#/product/${p.id}`)
              toast(`ส่งให้ ${who.name} แล้ว`); setSheet(null)
            }}><Av src={who.avatar} size={36} /><span className="grow ell">{who.name}<small className="ell">{t.title}</small></span><Icon name="send" size={18} color="var(--p)" /></button>
          })}</div>}
      </Sheet>
    </div>
  )
}

function BriefSheet({ open, onClose, p, opts, optId, setOptId }: { open: boolean; onClose: () => void; p: Product; opts: ReturnType<typeof optionsOf>; optId?: string; setOptId: (v: string) => void }) {
  const nav = useNavigate()
  const needs = arr(specOf(p).briefNeeds)
  const [vals, setVals] = useState<string[]>(() => needs.map(() => ''))
  const [sending, setSending] = useState(false)
  const opt = opts.find((o) => o.id === optId)
  const ok = vals.filter((v) => v.trim()).length >= Math.min(2, needs.length)
  return (
    <Sheet open={open} onClose={onClose} title="ส่งบรีฟงานจ้าง" sub={`${creatorById(p.creatorId).name} จะส่งใบเสนอราคากลับในแชต`} tall
      footer={<button className="btn btn-p btn-block" disabled={sending} {...blockTap(!ok, `กรอกบรีฟอย่างน้อย ${Math.min(2, needs.length)} ช่องก่อนส่ง`)} onClick={async () => {
        setSending(true)
        const id = await chat.sendBrief(p.creatorId, p.id, needs.map((n, i) => `${n}: ${vals[i] || '-'}`), `แพ็กเกจ${opt?.label ?? ''}`, opt?.price)
        onClose(); nav(`/chat/${id}`)
      }}>{sending ? 'กำลังส่ง…' : ok ? (p.price === 0 ? 'ส่งบรีฟ (งานฟรี)' : 'ส่งบรีฟ (ยังไม่ต้องจ่าย)') : 'กรอกอย่างน้อย 2 ช่อง'}</button>}>
      <div className="flabel">แพ็กเกจ</div>
      <div className="chips" style={{ marginBottom: 14 }}>{opts.map((o) => <button key={o.id} className={`chip ${o.id === optId ? 'on-p' : ''}`} onClick={() => setOptId(o.id)}>{o.label} · {o.price ? baht(o.price) : 'ฟรี'}</button>)}</div>
      {needs.map((n, i) => (
        <label key={n} className="field"><span className="flabel">{n}</span>
          <textarea className="ta" style={{ minHeight: 64 }} value={vals[i]} onChange={(e) => setVals(vals.map((v, j) => (j === i ? e.target.value : v)))} placeholder="พิมพ์สั้น ๆ ได้เลย" /></label>
      ))}
      <p className="hint">{REAL ? 'บรีฟจะส่งถึงครีเอเตอร์ในแชต' : 'ข้อมูลตัวอย่าง · บรีฟถูกเก็บในเครื่องนี้เท่านั้น ไม่ได้ส่งถึงครีเอเตอร์จริง'}</p>
    </Sheet>
  )
}

function TipSheet({ open, onClose, p, initial = 50 }: { open: boolean; onClose: () => void; p: Product; initial?: number }) {
  const nav = useNavigate()
  const [amt, setAmt] = useState(initial)
  const [custom, setCustom] = useState('')
  useEffect(() => { if (open) { setAmt(initial); setCustom('') } }, [open, initial])
  const c = creatorById(p.creatorId)
  const ok = amt >= 10 && amt <= 10000
  return (
    <Sheet open={open} onClose={onClose} title={`ให้ทิป ${c.name}`} sub="ไม่บังคับ · ครีเอเตอร์ได้รับทิปหลังหักค่าธรรมเนียมการชำระเงิน"
      footer={<button className="btn btn-p btn-block" {...blockTap(!ok, 'ทิปได้ตั้งแต่ ฿10 ถึง ฿10,000')} onClick={async () => {
        const key = await cart.add({ productId: 'tip', price: amt, title: `ทิปให้ ${c.name}`, creatorId: p.creatorId, image: c.avatar, optionLabel: 'ทิปขอบคุณ', direct: true })
        onClose(); nav(`/checkout?keys=${key}`)
      }}>{ok ? `ให้ทิป ${baht(amt)}` : 'ใส่จำนวน ฿10 – ฿10,000'}</button>}>
      <div className={s.tipr}>{[20, 50, 100, 200].map((a) => <button key={a} className={a === amt && !custom ? s.tipOn : ''} onClick={() => { setAmt(a); setCustom('') }}>฿{a}</button>)}</div>
      <div className="field" style={{ marginTop: 14 }}><label className="flabel" htmlFor="tip-amt">หรือใส่จำนวนเอง (บาท)</label>
        <input id="tip-amt" className="inp" inputMode="numeric" placeholder="เช่น 150" aria-label="จำนวนทิป" value={custom} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 5); setCustom(v); setAmt(Number(v) || 0) }} /></div>
    </Sheet>
  )
}
