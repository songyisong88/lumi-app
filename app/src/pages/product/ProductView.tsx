import { useEffect, useMemo, useRef, useState } from 'react'
import { FollowButton } from '../../components/FollowButton'
import { Link, useNavigate } from 'react-router-dom'
import { HeartButton } from '../../components/HeartButton'
import { Icon } from '../../components/Icon'
import { Av, copyText, Img, Sheet, Stars } from '../../components/ui'
import { LIC_ROWS, layoutOf, sellTypeOf, specOf, SPECS, str, arr, on, filesOf } from '../../data/listingSpec'
import { galleryOf, highlightsOf, optionsOf, pageContent, REVIEWS, reviewer, similarOf, statsOf, creatorStats } from '../../data/productExtras'
import { baht, creatorById, ME } from '../../data/sampleData'
import type { Product } from '../../data/types'
import { cart, chat, checkout } from '../../services/api'
import { getDb, useDb } from '../../services/db'
import { toast } from '../../services/toast'
import { Modules } from './modules'
import s from './Product.module.css'

type Sec = 'over' | 'get' | 'how' | 'rev' | 'sim'
const SECS: { v: Sec; label: string }[] = [
  { v: 'over', label: 'ภาพรวม' }, { v: 'get', label: 'ได้อะไรบ้าง' }, { v: 'how', label: 'วิธีใช้' }, { v: 'rev', label: 'รีวิว' }, { v: 'sim', label: 'คล้ายกัน' },
]

export function ProductView({ p, preview }: { p: Product; preview?: boolean }) {
  const nav = useNavigate()
  const db = useDb()
  const L = layoutOf(p)
  const t = sellTypeOf(p)
  const spec = specOf(p)
  const pc = pageContent(p)
  const opts = optionsOf(p)
  const [optId, setOptId] = useState(() => (opts.find((o) => o.best) ?? opts[0])?.id)
  const opt = opts.find((o) => o.id === optId) ?? opts[0]
  const c = creatorById(p.creatorId)
  const cs = creatorStats(p.creatorId, db.follows.includes(p.creatorId))
  const st = statsOf(p)
  const gallery = galleryOf(p)
  const owned = db.purchases.find((x) => x.productId === p.id)
  const mine = p.creatorId === ME
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState<null | 'brief' | 'tip' | 'free' | 'trial' | 'lesson' | 'share' | 'sendto' | 'added'>(null)
  const [freeThread, setFreeThread] = useState('')
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
  const guard = () => { if (preview) { toast('นี่คือตัวอย่างหน้าสินค้า ปุ่มยังกดซื้อไม่ได้'); return true } return false }
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
    const th = getDb().threads.find((x) => x.partnerId === p.creatorId && x.productId === p.id)
    setFreeThread(th?.id ?? '')
    setSheet('free')
  }

  const price = L === 'free' ? 0 : opt?.price ?? p.price
  const similar = useMemo(() => similarOf(p), [p])

  // bottom bar per layout (approved product-b “bar”)
  const bar = (() => {
    if (mine && !preview) return { sub: 'ผลงานของคุณ', main: <button className="btn btn-d" onClick={() => nav('/profile?mode=creator')}>จัดการผลงาน</button>, sec: <button className="btn btn-o btn-sm" onClick={() => setSheet('share')}><Icon name="share" size={16} />แชร์</button> }
    if (owned && L !== 'hire') return { sub: `ซื้อแล้ว · #${owned.orderNo}`, main: <button className="btn btn-p" onClick={() => owned.threadId ? nav(`/chat/${owned.threadId}`) : openChat()}><Icon name="download" size={18} color="#fff" />เปิดไฟล์และคีย์</button>, sec: null }
    switch (L) {
      case 'free': return { sub: 'ของฟรี', main: <button className="btn btn-p" disabled={busy} onClick={getFree}>{busy ? 'กำลังเตรียมไฟล์…' : 'ดาวน์โหลดฟรี'}</button>, sec: <button className="btn btn-o btn-sm" onClick={() => (guard() ? null : setSheet('tip'))}><Icon name="gift" size={16} color="#B45309" />ให้ทิป</button> }
      case 'hire': return { sub: `แพ็กเกจ${opt?.label ?? ''}`, main: <button className="btn btn-p" onClick={() => (guard() ? null : setSheet('brief'))}>ส่งบรีฟ</button>, sec: <button className="btn btn-o btn-sm" onClick={openChat}><Icon name="chat" size={16} color="var(--p)" />แชตถามก่อน</button> }
      default: {
        const second = L === 'sw' && on(spec.trial) ? <button className="btn btn-o btn-sm" onClick={async () => {
          if (guard()) return
          const tid = await chat.openWith(p.creatorId, p.id)
          await chat.sendCard(tid, { kind: 'file', fileName: `${p.title.replace(/\s+/g, '-')}-ทดลอง-${str(spec.trialDays).replace(/\s+/g, '')}.zip`, size: '12 MB' }, 'them')
          toast(`ส่งตัวทดลอง ${str(spec.trialDays)} ในแชตแล้ว`); nav(`/chat/${tid}`)
        }}><Icon name="play" size={15} color="var(--p)" />ทดลอง</button>
          : L === 'bot' && on(spec.trial) ? <button className="btn btn-o btn-sm" onClick={() => setSheet('trial')}><Icon name="qr" size={16} color="var(--p)" />ลองฟรี</button>
            : L === 'course' ? <button className="btn btn-o btn-sm" onClick={() => setSheet('lesson')}><Icon name="play" size={15} color="var(--p)" />ตอนแรกฟรี</button>
              : <button className={s.cartBtn} onClick={() => addToCart(false)} aria-label="เพิ่มลงตะกร้า"><Icon name="cart" size={21} /></button>
        return { sub: opt?.label ?? '', main: <button className="btn btn-p" onClick={() => addToCart(true)}>{L === 'course' ? 'ซื้อคอร์ส' : 'ซื้อเลย'}</button>, sec: second }
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
        {!preview && <Link to="/cart" className={s.hb} aria-label="ตะกร้า"><Icon name="cart" size={20} />{inCart > 0 && <span className={s.cnt}>{inCart}</span>}</Link>}
      </header>

      {/* gallery */}
      <div className={s.hero}>
        <div className={`hscroll ${s.slides}`} onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
          {gallery.map((g, i) => <Img key={g + i} src={g} className={s.slide} />)}
        </div>
        <div className={s.tyb}><span><Icon name={SPECS[t].icon} size={13} color="#fff" stroke={2.2} />{p.label ?? SPECS[t].name}{L === 'free' ? ' · ฟรี' : ''}</span>{p.mine && <span>ผลงานของคุณ</span>}</div>
        {!preview && <HeartButton productId={p.id} className={s.fav} />}
        {gallery.length > 1 && <div className={s.dots}>{gallery.map((_, i) => <i key={i} className={i === slide ? s.don : ''} />)}</div>}
      </div>

      <div className={s.pd}>
        <h1 className={s.ttl}>{p.title}</h1>
        <div className={s.rt}><Icon name="star" size={13} stroke={0} fill="#F5A524" /><b>{st.reviews ? st.rating : 'ใหม่'}</b>{st.reviews > 0 && <span>({st.reviews} รีวิว)</span>}<span>·</span><span>{st.soldLabel}</span></div>
        <div className={s.pr}>
          {L === 'free' ? <span className={s.free}>ฟรี</span> : <>{L === 'hire' && <small>เริ่มต้น</small>}<b>{baht(L === 'hire' ? Math.min(...opts.map((o) => o.price)) : price)}{opt?.suffix ?? ''}</b></>}
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
          <Modules unlocked={mine || !!owned} p={p} L={L} spec={spec} opts={opts} optId={opt?.id} setOptId={setOptId} onTip={(a) => { if (guard()) return; setTipAmt(a ?? 50); setSheet('tip') }} onTrial={() => setSheet('trial')} onLesson={() => setSheet('lesson')} />
          {p.desc && <><div className={s.st}>รายละเอียด</div><p className={s.desc}>{p.desc}</p></>}
          {pc.facts.length > 0 && <div className={s.spec} style={{ marginTop: 14 }}>{pc.facts.map(([k, v]) => <div key={k}>{k}<b>{v}</b></div>)}</div>}
        </section>

        <section data-sec="get">
          <div className={s.st}>สิ่งที่คุณจะได้รับ</div>
          <div className={s.box}>{pc.deliver.map((d, i) => <div key={i} className={s.ok}><span className="ok-ic"><Icon name="check" size={13} stroke={3} /></span>{d}</div>)}</div>
          {filesOf(spec.files).length > 0 && (
            <div className={s.scan}><Icon name="shield" size={22} color="#16A34A" /><div><b>สแกนไวรัสแล้ว ปลอดภัย</b>{filesOf(spec.files).length} ไฟล์ · ตรวจโดย LUMI ก่อนเปิดขาย</div></div>
          )}
          {L === 'hire' || t === 'hire' ? <div className={s.scan} style={{ background: '#EEF2FF', color: '#3730A3' }}><Icon name="lock" size={22} color="#4F46E5" /><div><b>จ่ายผ่าน LUMI ปลอดภัย</b>เงินพักไว้จนกว่าคุณจะกดรับงาน</div></div> : null}
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
                <tbody>{LIC_ROWS.map((r) => <tr key={r}><td>{r}</td><td className={pc.lic!.includes(r) ? s.yes : s.no}>{pc.lic!.includes(r) ? '✓ ได้' : '–'}</td></tr>)}</tbody></table>
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
          {st.reviews === 0 ? <p className="muted" style={{ fontSize: 13.5 }}>ยังไม่มีรีวิว · รีวิวจะขึ้นเมื่อมีคนซื้อและให้คะแนน</p> : (
            <>
              <div className={s.rvs}><div><div className={s.big}>{st.rating}</div><Stars v={st.rating} /></div>
                <div className={s.bars}>{[[5, 86], [4, 10], [3, 3], [2, 1], [1, 0]].map(([n, w]) => <div key={n}>{n}<i><b style={{ transform: `scaleX(${w / 100})` }} /></i></div>)}</div></div>
              {REVIEWS.map((r, i) => (
                <div key={i} className={s.rv}>
                  <div className={s.rvh}><Av src={reviewer(r.who).avatar} size={26} />{reviewer(r.who).name}<span className="pill pill-g" style={{ marginLeft: 6 }}>ซื้อแล้ว</span><small>{r.when}</small></div>
                  <Stars v={r.stars} /><p>{r.text}</p>
                  {r.pic && <Img src={gallery[0]} className={s.rvpic} />}
                </div>
              ))}
            </>
          )}
        </section>

        <section data-sec="sim">
          <div className={s.st}>ผลงานคล้ายกัน</div>
          <div className={s.sim}>
            {similar.map((x) => (
              <Link key={x.id} to={`/product/${x.id}`} className={`${s.simc} press`} onClick={(e) => preview && e.preventDefault()}>
                <Img src={galleryOf(x)[0]} className={s.simi} />
                <b className="ell2">{x.title}</b><small>{creatorById(x.creatorId).name} · {x.price ? baht(x.price) : 'ฟรี'}</small>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {!preview && (
        <div className={`bottom-bar ${s.bar}`}>
          <div className={s.pp}><small>{bar.sub}</small><b style={L === 'free' ? { color: '#16A34A' } : undefined}>{L === 'free' ? 'ฟรี' : `${baht(price)}${opt?.suffix ?? ''}`}</b></div>
          {bar.sec}
          {bar.main}
        </div>
      )}

      {/* sheets */}
      <BriefSheet open={sheet === 'brief'} onClose={() => setSheet(null)} p={p} opts={opts} optId={opt?.id} setOptId={setOptId} />
      <TipSheet open={sheet === 'tip'} onClose={() => setSheet(null)} p={p} initial={tipAmt} />
      <Sheet open={sheet === 'added'} onClose={() => setSheet(null)} title="เพิ่มลงตะกร้าแล้ว" sub={`${p.title} · ${opt?.label ?? ''}`}
        footer={<><button className="btn btn-o" style={{ flex: 1 }} onClick={() => setSheet(null)}>ดูต่อ</button><button className="btn btn-p" style={{ flex: 1 }} onClick={() => { setSheet(null); nav('/cart') }}>ไปที่ตะกร้า ({inCart})</button></>}>
        <div className={s.addedRow}><Img src={gallery[0]} className={s.addedImg} /><div><b className="ell2">{p.title}</b><small className="muted">{opt?.label}</small></div><b>{baht(opt?.price ?? p.price)}</b></div>
      </Sheet>
      <Sheet open={sheet === 'free'} onClose={() => setSheet(null)} title="ได้รับแล้ว 🎉" sub="ไฟล์ส่งเข้าแชตกับครีเอเตอร์ และอยู่ใน โปรไฟล์ › ซื้อแล้ว"
        footer={<><button className="btn btn-o" style={{ flex: 1 }} onClick={() => { setSheet(null); setSheet('tip') }}>ให้ทิป</button><button className="btn btn-p" style={{ flex: 1 }} onClick={() => { setSheet(null); nav(freeThread ? `/chat/${freeThread}` : '/chat') }}>เปิดไฟล์</button></>}>
        <div className={s.box}>{pc.deliver.slice(0, 4).map((d, i) => <div key={i} className={s.ok}><span className="ok-ic"><Icon name="check" size={13} stroke={3} /></span>{d}</div>)}</div>
      </Sheet>
      <Sheet open={sheet === 'trial'} onClose={() => setSheet(null)} title={`ทดลองฟรี ${str(spec.trialDays)}`} sub="สแกนด้วยมือถือเพื่อเปิดในแอป (ตัวอย่าง)">
        <div className={s.trialBox}><Icon name="qr" size={150} stroke={1.4} /><code>{str(spec.trialLink) || 'line.me/R/ti/p/@lumi-demo'}</code>
          <button className="btn btn-s btn-sm" onClick={() => { copyText(str(spec.trialLink)); toast('คัดลอกลิงก์แล้ว') }}><Icon name="copy" size={15} />คัดลอกลิงก์</button>
          <p className="muted" style={{ fontSize: 12.5 }}>ลิงก์ตัวอย่าง ยังไม่ได้เชื่อมบอทจริง</p></div>
      </Sheet>
      <Sheet open={sheet === 'lesson'} onClose={() => setSheet(null)} title={arr(spec.lessons)[0]?.split(' · ').slice(0, 2).join(' · ') ?? 'ตอนแรกฟรี'} sub="ดูฟรี ไม่ต้องซื้อ">
        <div className={s.video}><Img src={gallery[0]} className={s.videoImg} /><span className={s.playBig}><Icon name="play" size={30} color="#fff" fill="#fff" /></span><div className={s.vbar}><i /></div></div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>ตัวเล่นวิดีโอตัวอย่าง · วิดีโอจริงจะเปิดหลังเชื่อมระบบเก็บไฟล์</p>
      </Sheet>
      <Sheet open={sheet === 'share'} onClose={() => setSheet(null)} title="แชร์ผลงานนี้">
        <div className={s.shareRow}>
          {[['link', 'คัดลอกลิงก์'], ['chat', 'ส่งในแชต LUMI'], ['users', 'โพสต์ลงชุมชน']].map(([ic, l]) => (
            <button key={l} onClick={() => {
              if (preview) { toast('ตัวอย่างก่อนลงขาย · แชร์ได้หลังลงขาย'); setSheet(null); return }
              if (l === 'คัดลอกลิงก์') { copyText(`${location.origin}${location.pathname}#/product/${p.id}`); toast('คัดลอกลิงก์แล้ว'); setSheet(null) }
              else if (l === 'ส่งในแชต LUMI') setSheet('sendto')
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
      footer={<button className="btn btn-p btn-block" disabled={!ok || sending} onClick={async () => {
        setSending(true)
        const id = await chat.sendBrief(p.creatorId, p.id, needs.map((n, i) => `${n}: ${vals[i] || '-'}`), `แพ็กเกจ${opt?.label ?? ''}`)
        onClose(); nav(`/chat/${id}`)
      }}>{sending ? 'กำลังส่ง…' : ok ? 'ส่งบรีฟ (ยังไม่ต้องจ่าย)' : 'กรอกอย่างน้อย 2 ช่อง'}</button>}>
      <div className="flabel">แพ็กเกจ</div>
      <div className="chips" style={{ marginBottom: 14 }}>{opts.map((o) => <button key={o.id} className={`chip ${o.id === optId ? 'on-p' : ''}`} onClick={() => setOptId(o.id)}>{o.label} · {baht(o.price)}</button>)}</div>
      {needs.map((n, i) => (
        <label key={n} className="field"><span className="flabel">{n}</span>
          <textarea className="ta" style={{ minHeight: 64 }} value={vals[i]} onChange={(e) => setVals(vals.map((v, j) => (j === i ? e.target.value : v)))} placeholder="พิมพ์สั้น ๆ ได้เลย" /></label>
      ))}
      <p className="hint">ข้อมูลตัวอย่าง · บรีฟถูกเก็บในเครื่องนี้เท่านั้น ไม่ได้ส่งถึงครีเอเตอร์จริง</p>
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
    <Sheet open={open} onClose={onClose} title={`ให้ทิป ${c.name}`} sub="ไม่บังคับ · ทิปส่งถึงครีเอเตอร์เต็มจำนวน"
      footer={<button className="btn btn-p btn-block" disabled={!ok} onClick={async () => {
        const key = await cart.add({ productId: 'tip', price: amt, title: `ทิปให้ ${c.name}`, creatorId: p.creatorId, image: c.avatar, optionLabel: 'ทิปขอบคุณ', direct: true })
        onClose(); nav(`/checkout?keys=${key}`)
      }}>{ok ? `ให้ทิป ${baht(amt)}` : 'ใส่จำนวน ฿10 – ฿10,000'}</button>}>
      <div className={s.tipr}>{[20, 50, 100, 200].map((a) => <button key={a} className={a === amt && !custom ? s.tipOn : ''} onClick={() => { setAmt(a); setCustom('') }}>฿{a}</button>)}</div>
      <div className="field" style={{ marginTop: 14 }}><label className="flabel" htmlFor="tip-amt">หรือใส่จำนวนเอง (บาท)</label>
        <input id="tip-amt" className="inp" inputMode="numeric" placeholder="เช่น 150" aria-label="จำนวนทิป" value={custom} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 5); setCustom(v); setAmt(Number(v) || 0) }} /></div>
    </Sheet>
  )
}
