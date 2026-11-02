import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FollowButton } from '../components/FollowButton'
import { Header } from '../components/Header'
import { Icon } from '../components/Icon'
import { scrollPageTop } from '../components/Stage'
import { Sheet } from '../components/ui'
import { MasonryFeed } from '../components/MasonryFeed'
import { ProductCard } from '../components/ProductCard'
import { CREATORS, ME, PRODUCTS, creatorById, imgUrl } from '../data/sampleData'
import type { Product } from '../data/types'
import { creatorStats, statsOf } from '../data/productExtras'
import {
  CATEGORIES, CAT_TOTAL, CHALLENGE, GROUPS, HOT_KEYWORDS, LEADERBOARD, NEW_TODAY, NEW_TODAY_COUNT, POPULAR, SEARCH_GROUPS, SHORT, TRENDS,
  challengeEnd, isCatKey, searchWorks, type CatKey,
} from '../data/searchData'
import s from './Search.module.css'

/*
 * APPROVED LAYOUT: search-v5-a (owner-approved; commit 34c8006). Do not change the look,
 * sections or their order without the owner's approval.
 * Order: เทรนด์ › ภาพและดีไซน์ › ซอฟต์แวร์ แอป และเกม › ใหม่วันนี้ › ธุรกิจและ AI ›
 * ครีเอเตอร์แห่งสัปดาห์ › เรียนรู้ บริการ และของฟรี › โจทย์ › ผลงานสำหรับคุณ.
 * The switches below keep later, NOT-yet-approved proposals in the code but switched off.
 */
/** Trends, creators of the week and the challenge (approved v5-a sections; numbers are sample data). */
const SHOW_SAMPLE_STATS = true
/** 'groups' = approved v5-a category tiles. 'chips' = popular-chip row + ทุกหมวด sheet (proposal, off). */
const CATEGORY_LAYOUT = 'groups' as 'groups' | 'chips'
/** Sort / price filter / ครีเอเตอร์ tab on results (proposal from the structure review, off until approved). */
const RESULT_FILTERS = false

const SORTS = [
  { id: 'rel', label: 'เกี่ยวข้อง' },
  { id: 'new', label: 'ใหม่ล่าสุด' },
  { id: 'rate', label: 'รีวิวดี' },
  { id: 'lo', label: 'ราคาต่ำ-สูง' },
  { id: 'hi', label: 'ราคาสูง-ต่ำ' },
] as const
const PRICES = [
  { id: 'all', label: 'ทุกราคา', ok: () => true },
  { id: 'free', label: 'ฟรี', ok: (p: Product) => p.price === 0 },
  { id: 'u100', label: 'ไม่เกิน ฿100', ok: (p: Product) => p.price > 0 && p.price <= 100 },
  { id: 'u500', label: '฿101–500', ok: (p: Product) => p.price > 100 && p.price <= 500 },
  { id: 'o500', label: 'มากกว่า ฿500', ok: (p: Product) => p.price > 500 },
] as const
type SortId = (typeof SORTS)[number]['id']
type PriceId = (typeof PRICES)[number]['id']

function arrange(list: Product[], sort: SortId, price: PriceId) {
  const ok = PRICES.find((x) => x.id === price)!.ok
  const out = list.filter(ok)
  const idx = new Map(list.map((p, i) => [p.id, i]))
  if (sort === 'lo') out.sort((a, b) => a.price - b.price)
  if (sort === 'hi') out.sort((a, b) => b.price - a.price)
  if (sort === 'rate') out.sort((a, b) => statsOf(b).rating - statsOf(a).rating || statsOf(b).reviews - statsOf(a).reviews)
  if (sort === 'new') out.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0) || idx.get(b.id)! - idx.get(a.id)!)
  return out
}

function matchCreators(q: string, works: Product[]) {
  const w = q.toLowerCase().trim()
  const ids = new Set(works.map((p) => p.creatorId))
  return CREATORS.filter((c) => ids.has(c.id) || (w && (c.name.toLowerCase().includes(w) || c.id.includes(w))))
}

/* ---------- small pieces ---------- */

function SectionHead({ title, right, onRight }: { title: ReactNode; right?: string; onRight?: () => void }) {
  return (
    <div className={s.sh}>
      <h2>{title}</h2>
      {right && (onRight ? <button onClick={onRight}>{right}</button> : <span>{right}</span>)}
    </div>
  )
}

/** Approved v5-a: one category group (coloured heading + tile grid). */
function CategoryGroup({ g, onPick }: { g: (typeof SEARCH_GROUPS)[number]; onPick: (k: CatKey) => void }) {
  return (
    <section>
      <div className={s.gh}><i style={{ background: g.color }} />{g.name}<span>{g.keys.length} ประเภท</span></div>
      <div className={s.grid}>
        {g.keys.map((k) => {
          const c = CATEGORIES[k]
          return (
            <button key={k} data-cat={k} className={`${s.tile} ${c.span ? s[`s${c.span}`] : ''}`} style={c.span ? { borderTopColor: g.color } : undefined} onClick={() => onPick(k)}>
              <span className={`${s.ti} ${c.flip ? s.flip : ''}`} style={{ backgroundImage: `url(${imgUrl(c.tileImage ?? c.image, true)})` }} />
              <span className={s.tx}>
                <b><i style={{ background: c.accent }} />{c.name}</b>
                <small>{c.count} ชิ้น · {c.sub}</small>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** Proposal (off): one horizontal chip row of the popular categories + “ดูทั้งหมด”. */
function PopularCats({ onPick, onAll }: { onPick: (k: CatKey) => void; onAll: () => void }) {
  return (
    <section>
      <SectionHead title="หมวดยอดนิยม" right="เลื่อนดู ›" />
      <div className={`hscroll ${s.cps}`}>
        {POPULAR.map((k, i) => {
          const c = CATEGORIES[k]
          return (
            <button key={k} data-cat={k} className={`${s.cp} rise press`} style={{ '--i': i } as React.CSSProperties} onClick={() => onPick(k)}>
              <span className={s.cpt}><span className={`${s.cth} ${c.flip ? s.flip : ''}`} style={{ backgroundImage: `url(${imgUrl(c.image, true)})` }} /><b>{SHORT[k] ?? c.name}</b></span>
              <small>{c.desc}</small>
            </button>
          )
        })}
        <button className={`${s.cp} ${s.cpAll} rise press`} style={{ '--i': POPULAR.length } as React.CSSProperties} onClick={onAll} aria-haspopup="dialog">
          <span className={s.cpt}><span className={s.cai}><Icon name="grid" size={16} color="#fff" stroke={2} /></span><b>ดูทั้งหมด</b></span>
          <small>{CAT_TOTAL - 1} หมวด + ของฟรี</small>
        </button>
      </div>
    </section>
  )
}

/** “ทุกหมวด” bottom sheet: search box + one group per sell type (11) + ของฟรี, with all 19 categories (new ones marked ใหม่). */
function AllCatsSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (k: CatKey) => void }) {
  const [f, setF] = useState('')
  const term = f.trim().toLowerCase()
  const hit = (k: CatKey) => !term || `${CATEGORIES[k].name} ${CATEGORIES[k].desc} ${CATEGORIES[k].sub}`.toLowerCase().includes(term)
  const groups = GROUPS.map((g) => ({ ...g, keys: g.keys.filter(hit) })).filter((g) => g.keys.length)
  return (
    <Sheet open={open} onClose={onClose} title="ทุกหมวด" sub={`${CAT_TOTAL - 1} หมวด + ของฟรี · แตะเพื่อดูผลงานในหมวด`} tall>
      <div className={s.bsq}>
        <Icon name="search" size={17} color="#8A86A0" />
        <input value={f} onChange={(e) => setF(e.target.value)} placeholder="ค้นหาหมวด เช่น ฟอนต์ เพลง ข้อมูล" aria-label="ค้นหาหมวด" />
        {f && <button onClick={() => setF('')} aria-label="ล้าง"><Icon name="x" size={14} stroke={2.6} /></button>}
      </div>
      {groups.length === 0 && <p className={s.bsNone}>ไม่พบหมวด “{f}” ลองคำอื่น หรือค้นหาผลงานโดยตรง</p>}
      {groups.map((g) => (
        <div key={g.name}>
          <div className={s.bgh} data-group={g.type ?? "free"}><i style={{ background: g.color }} />{g.name}<span>{g.keys.length} หมวด</span></div>
          {g.keys.map((k) => {
            const c = CATEGORIES[k]
            return (
              <button key={k} data-sheetcat={k} className={s.brw} onClick={() => onPick(k)}>
                <span className={`${s.bth} ${c.flip ? s.flip : ''}`} style={{ backgroundImage: `url(${imgUrl(c.image, true)})` }} />
                <span className={s.brt}><b>{c.name}{c.isNew && <span className={s.nwb}>ใหม่</span>}</b><small>{c.desc}</small></span>
                <em>{c.count}</em>
                <Icon name="chev" size={16} color="#B4AFC8" stroke={2.2} />
              </button>
            )
          })}
        </div>
      ))}
      <div className={s.bsf}>ตัวเลขจำนวนผลงานเป็นข้อมูลตัวอย่าง · หมวดที่มีป้าย “ใหม่” เปิดให้ลงขายได้แล้ว</div>
    </Sheet>
  )
}

function TrendCarousel({ onPick }: { onPick: (q: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const onScroll = () => {
    const el = ref.current
    if (!el || !el.firstElementChild) return
    const w = (el.firstElementChild as HTMLElement).offsetWidth + 10
    setPage(Math.min(TRENDS.length - 1, Math.round(el.scrollLeft / w)))
  }
  return (
    <section>
      <SectionHead title={<><Icon name="trend" size={17} color="#7C3AED" stroke={2.4} />เทรนด์ช่วงนี้</>} />
      <div className={s.car} ref={ref} onScroll={onScroll}>
        {TRENDS.map((t, i) => (
          <button key={t.title} className={s.trd} style={{ backgroundImage: `url(${imgUrl(t.image, true)})` }} onClick={() => onPick(t.q)}>
            <span className={s.rk}>เทรนด์ #{i + 1}</span>
            <span className={s.tin}>
              <b>{t.title}</b>
              <small>{t.sub}</small>
              <span className={s.trm}>
                <span className={s.cnt}>{t.count} ชิ้น</span>
                <span className={s.rise}><Icon name="up" size={11} color="#fff" stroke={2.8} />{t.rise} สัปดาห์นี้</span>
                <span className={s.dots}>{t.dots.map((c) => <i key={c} style={{ background: c }} />)}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className={s.pg}>{TRENDS.map((t, i) => <i key={t.title} className={i === page ? s.on : ''} />)}</div>
    </section>
  )
}

function NewToday({ onAll }: { onAll: () => void }) {
  return (
    <section>
      <SectionHead title={<><span className={s.ldot} />ใหม่วันนี้ <em className={s.nc}>{NEW_TODAY_COUNT}</em></>} right="ดูทั้งหมด" onRight={onAll} />
      <div className={s.shelf}>
        {NEW_TODAY.map(({ p, ago }) => (
          <div key={p.id} className={s.shelfItem}>
            <ProductCard p={{ ...p, ratio: '1/1' }} badge={<span className={s.nw}><i />{ago}</span>} />
          </div>
        ))}
      </div>
    </section>
  )
}

function CreatorsOfWeek({ onPick }: { onPick: (name: string) => void }) {
  const podium = [1, 0, 2].map((i) => ({ ...LEADERBOARD[i], rank: i + 1 }))
  return (
    <section>
      <SectionHead title="🏆 ครีเอเตอร์แห่งสัปดาห์" />
      <div className={s.lb}>
        <div className={s.pod}>
          {podium.map((r) => {
            const c = creatorById(r.creatorId)
            return (
              <button key={r.creatorId} className={`${s.pd} ${s[`p${r.rank}`]}`} onClick={() => onPick(c.name)}>
                <span className={s.pa} style={{ backgroundImage: `url(${imgUrl(c.avatar)})` }}><span>{r.rank}</span></span>
                <b>{c.name}</b>
                <small>{r.pts.toLocaleString('th-TH')} แต้ม</small>
              </button>
            )
          })}
        </div>
        {LEADERBOARD.slice(3, 5).map((r, i) => {
          const c = creatorById(r.creatorId)
          return (
            <div key={r.creatorId} className={s.lr}>
              <b>{i + 4}</b>
              <button className={s.lrMain} onClick={() => onPick(c.name)}>
                <span className={s.la} style={{ backgroundImage: `url(${imgUrl(c.avatar)})` }} />
                <span><span>{c.name}</span><small>{r.what}</small></span>
              </button>
              <em>{r.pts.toLocaleString('th-TH')} แต้ม</em>
              <FollowButton id={r.creatorId} className={s.fol} onClass={s.folOn} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Time left until the weekly challenge closes (Monday 00:00 Bangkok, same as ชุมชน › กิจกรรม). */
function useChallengeCountdown() {
  const calc = () => Math.max(0, Math.floor((challengeEnd() - Date.now()) / 1000))
  const [left, setLeft] = useState(calc)
  useEffect(() => {
    const t = setInterval(() => setLeft(calc()), 1000)
    return () => clearInterval(t)
  }, [])
  const p2 = (n: number) => String(n).padStart(2, '0')
  const d = Math.floor(left / 86400)
  return `${d ? `${d} วัน ` : ''}${p2(Math.floor((left % 86400) / 3600))}:${p2(Math.floor((left % 3600) / 60))}:${p2(left % 60)}`
}

function DailyChallenge() {
  const left = useChallengeCountdown()
  return (
    <section>
      <SectionHead title="✏️ โจทย์ประจำสัปดาห์" right="ส่งผลงานรับแต้ม" />
      <div className={s.ch}>
        <div className={s.cht}><span>สัปดาห์นี้วาดอะไรดี?</span><em>เหลือ {left}</em></div>
        <b>“{CHALLENGE.prompt}”</b>
        <small>{CHALLENGE.note}</small>
        <div className={s.chf}>
          <span className={s.avs}>{CHALLENGE.avatars.map((a) => <i key={a} style={{ backgroundImage: `url(${imgUrl(creatorById(a).avatar)})` }} />)}</span>
          <small>ส่งแล้ว {CHALLENGE.joined} คน</small>
          <Link to="/community/activities" className={s.chb}>ร่วมสนุก</Link>
        </div>
      </div>
    </section>
  )
}

/* ---------- page ---------- */

export function Search() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const catParam = params.get('cat')
  const cat: CatKey | 'new' | null = catParam === 'new' ? 'new' : isCatKey(catParam) ? catParam : null
  const [focused, setFocused] = useState(false)
  const [toast, setToast] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const tab = RESULT_FILTERS && params.get('tab') === 'creators' ? 'creators' : 'works'
  const sort = ((RESULT_FILTERS && SORTS.find((x) => x.id === params.get('sort'))?.id) || 'rel') as SortId
  const price = ((RESULT_FILTERS && PRICES.find((x) => x.id === params.get('price'))?.id) || 'all') as PriceId
  const found = useMemo(() => searchWorks(q, cat), [q, cat])
  const results = useMemo(() => arrange(found, sort, price), [found, sort, price])
  const creators = useMemo(() => matchCreators(q, found), [q, found])
  const nav = useNavigate()
  const searching = q.trim() !== '' || cat !== null

  const update = (next: { q?: string; cat?: string | null; tab?: string; sort?: string; price?: string }, replace = false) => {
    const p = new URLSearchParams()
    const nq = next.q ?? q
    const nc = next.cat === undefined ? cat : next.cat
    const keep = next.q === undefined && next.cat === undefined
    const nt = next.tab ?? (keep ? tab : 'works')
    const ns = next.sort ?? (keep ? sort : 'rel')
    const np = next.price ?? (keep ? price : 'all')
    if (nq) p.set('q', nq)
    if (nc) p.set('cat', nc)
    if (nt !== 'works') p.set('tab', nt)
    if (ns !== 'rel') p.set('sort', ns)
    if (np !== 'all') p.set('price', np)
    setParams(p, { replace })
  }
  const pickQuery = (text: string) => { update({ q: text, cat: null }); inputRef.current?.blur(); scrollPageTop() }
  const pickCat = (k: CatKey | 'new') => { update({ q: '', cat: k }); scrollPageTop() }
  const [allCats, setAllCats] = useState(false)
  const pickFromSheet = (k: CatKey) => { setAllCats(false); setTimeout(() => pickCat(k), 180) }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])


  const chipsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    chipsRef.current?.querySelector(`.${s.chipOn}`)?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [cat, searching])

  const catLabel = cat === 'new' ? 'ใหม่วันนี้' : cat ? CATEGORIES[cat].name : ''

  return (
    <>
      <div className={s.deskHeader}><Header /></div>
      <header className={s.hdr}>
        <div className={`wrap ${s.row}`}>
          <button className={s.back} aria-label="กลับ" onClick={() => (searching ? update({ q: '', cat: null }) : nav('/'))}>
            <Icon name="back" size={22} stroke={2.4} />
          </button>
          <form className={`${s.sin} ${focused ? s.act : ''}`} role="search" onSubmit={(e) => { e.preventDefault(); inputRef.current?.blur() }}>
            <Icon name="search" size={18} color="#8A86A0" />
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              value={q}
              placeholder="ค้นหาภาพ เทมเพลต เครื่องมือ บอท"
              aria-label="ค้นหาผลงาน"
              onChange={(e) => update({ q: e.target.value }, true)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
            />
            {q && <button type="button" className={s.clr} aria-label="ล้างคำค้น" onClick={() => update({ q: '' }, true)}><Icon name="x" size={14} stroke={2.6} /></button>}
            <button type="button" className={s.cam} aria-label="ค้นหาด้วยรูปภาพ" onClick={() => setToast('ค้นหาด้วยรูปภาพ กำลังพัฒนา จะเปิดใช้เร็ว ๆ นี้')}>
              <Icon name="camera" size={17} color="#6C2BD9" stroke={2.1} />
            </button>
          </form>
        </div>
        {focused && !q && (
          <div className={`wrap ${s.suggest}`}>
            <div className={s.sgT}><Icon name="fire" size={13} color="#EF4444" fill="#EF4444" stroke={0} />คำค้นยอดฮิต</div>
            <div className={s.sgW}>{HOT_KEYWORDS.map((k, i) => (
              <button key={k} onMouseDown={(e) => e.preventDefault()} onClick={() => pickQuery(k)}><b className={i < 3 ? s.hot : ''}>{i + 1}</b>{k}</button>
            ))}</div>
          </div>
        )}
      </header>

      <main className={`wrap page ${s.main}`}>
        {searching ? (
          <>
            <div className={`hscroll ${s.chips}`} ref={chipsRef}>
              <button className={!cat ? s.chipOn : ''} onClick={() => update({ cat: null })}>ทั้งหมด</button>
              {(Object.keys(CATEGORIES) as CatKey[]).map((k) => (
                <button key={k} className={cat === k ? s.chipOn : ''} onClick={() => update({ cat: k })}>
                  <i style={{ background: CATEGORIES[k].accent }} />{CATEGORIES[k].name}
                </button>
              ))}
            </div>
            <div className={s.rh}>
              <h1>{q ? <>ผลการค้นหา “{q}”</> : catLabel}</h1>
              <span>{tab === 'creators' ? `${creators.length} คน` : `${results.length} ชิ้น`}{q && cat ? ` · ใน${catLabel}` : ''}</span>
            </div>
            {RESULT_FILTERS && <div className={s.rtabs} role="tablist" aria-label="ประเภทผลลัพธ์">
              <button role="tab" aria-selected={tab === 'works'} className={tab === 'works' ? s.rtOn : ''} onClick={() => update({ tab: 'works' }, true)}>ผลงาน</button>
              <button role="tab" aria-selected={tab === 'creators'} className={tab === 'creators' ? s.rtOn : ''} onClick={() => update({ tab: 'creators' }, true)}>ครีเอเตอร์</button>
            </div>}
            {RESULT_FILTERS && tab === 'works' && (
              <div className={s.filt} data-filters>
                <label><span>เรียง</span><select aria-label="เรียงผลลัพธ์" value={sort} onChange={(e) => update({ sort: e.target.value }, true)}>
                  {SORTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select></label>
                <label><span>ราคา</span><select aria-label="กรองราคา" value={price} onChange={(e) => update({ price: e.target.value }, true)}>
                  {PRICES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select></label>
              </div>
            )}
            {tab === 'creators' ? (creators.length > 0 ? (
              <div className={s.clist}>
                {creators.map((c) => {
                  const st = creatorStats(c.id)
                  return (
                    <div key={c.id} className={s.crow}>
                      <button className={s.crowMain} onClick={() => nav(`/creator/${c.id}`)}>
                        <img src={imgUrl(c.avatar)} alt="" />
                        <span><b>{c.name}</b><small>{st.works} ผลงาน · ★ {st.rating || '-'} · ผู้ติดตาม {st.followersLabel}</small></span>
                      </button>
                      {c.id !== ME && <FollowButton id={c.id} />}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={s.empty}><b>ยังไม่เจอครีเอเตอร์ที่ตรงกับคำนี้</b><p>ลองค้นด้วยชื่อร้านหรือประเภทผลงาน</p></div>
            )) : results.length > 0 ? (
              <MasonryFeed items={results} />
            ) : (
              <div className={s.empty}>
                <b>ยังไม่เจอผลงานที่ตรงกับ{price !== 'all' ? 'ช่วงราคานี้' : 'คำนี้'}</b>
                {price !== 'all' && <button className="btn btn-o btn-sm" style={{ marginTop: 10 }} onClick={() => update({ price: 'all' }, true)}>ดูทุกราคา</button>}
                <p>ลองคำอื่นดูนะ หรือเลือกจากคำค้นยอดฮิต</p>
                <div className={s.sgW}>{HOT_KEYWORDS.slice(0, 6).map((k) => <button key={k} onClick={() => pickQuery(k)}>{k}</button>)}</div>
              </div>
            )}
          </>
        ) : (
          <>
            {SHOW_SAMPLE_STATS && <TrendCarousel onPick={pickQuery} />}
            {CATEGORY_LAYOUT === 'chips' && <PopularCats onPick={pickCat} onAll={() => setAllCats(true)} />}
            {CATEGORY_LAYOUT === 'groups' && <CategoryGroup g={SEARCH_GROUPS[0]} onPick={pickCat} />}
            {CATEGORY_LAYOUT === 'groups' && <CategoryGroup g={SEARCH_GROUPS[1]} onPick={pickCat} />}
            <NewToday onAll={() => pickCat('new')} />
            {CATEGORY_LAYOUT === 'groups' && <CategoryGroup g={SEARCH_GROUPS[2]} onPick={pickCat} />}
            {SHOW_SAMPLE_STATS && <CreatorsOfWeek onPick={pickQuery} />}
            {CATEGORY_LAYOUT === 'groups' && <CategoryGroup g={SEARCH_GROUPS[3]} onPick={pickCat} />}
            {SHOW_SAMPLE_STATS && <DailyChallenge />}
            <section>
              <SectionHead title="ผลงานสำหรับคุณ" right="คละทุกประเภท" />
              <MasonryFeed items={PRODUCTS} />
            </section>
          </>
        )}
      </main>
      {SHOW_SAMPLE_STATS && <div className={s.sbadge} aria-hidden="true">ข้อมูลตัวอย่าง</div>}
      {toast && <div className={s.toast} role="status">{toast}</div>}
      {CATEGORY_LAYOUT === 'chips' && <AllCatsSheet open={allCats} onClose={() => setAllCats(false)} onPick={pickFromSheet} />}
    </>
  )
}
