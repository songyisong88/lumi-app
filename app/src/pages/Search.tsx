import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { Icon } from '../components/Icon'
import { MasonryFeed } from '../components/MasonryFeed'
import { ProductCard } from '../components/ProductCard'
import { PRODUCTS, creatorById, imgUrl } from '../data/sampleData'
import {
  CATEGORIES, CHALLENGE, GROUPS, HOT_KEYWORDS, LEADERBOARD, NEW_TODAY, NEW_TODAY_COUNT, TRENDS,
  isCatKey, searchWorks, type CatKey,
} from '../data/searchData'
import s from './Search.module.css'

/* ---------- small pieces ---------- */

function SectionHead({ title, right, onRight }: { title: ReactNode; right?: string; onRight?: () => void }) {
  return (
    <div className={s.sh}>
      <h2>{title}</h2>
      {right && (onRight ? <button onClick={onRight}>{right}</button> : <span>{right}</span>)}
    </div>
  )
}

function CategoryGroup({ g, onPick }: { g: (typeof GROUPS)[number]; onPick: (k: CatKey) => void }) {
  return (
    <section>
      <div className={s.gh}><i style={{ background: g.color }} />{g.name}<span>{g.keys.length} ประเภท</span></div>
      <div className={s.grid}>
        {g.keys.map((k) => {
          const c = CATEGORIES[k]
          return (
            <button key={k} className={`${s.tile} ${c.span ? s[`s${c.span}`] : ''}`} style={c.span ? { borderTopColor: g.color } : undefined} onClick={() => onPick(k)}>
              <span className={`${s.ti} ${c.flip ? s.flip : ''}`} style={{ backgroundImage: `url(${imgUrl(c.image)})` }} />
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
          <button key={t.title} className={s.trd} style={{ backgroundImage: `url(${imgUrl(t.image)})` }} onClick={() => onPick(t.q)}>
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
  const [following, setFollowing] = useState<string[]>([])
  const toggle = (id: string) => setFollowing((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
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
                <small><Icon name="heart" size={10} color="#EC4899" fill="#EC4899" stroke={0} /> {r.hearts}</small>
              </button>
            )
          })}
        </div>
        {LEADERBOARD.slice(3).map((r, i) => {
          const c = creatorById(r.creatorId)
          const on = following.includes(r.creatorId)
          return (
            <div key={r.creatorId} className={s.lr}>
              <b>{i + 4}</b>
              <button className={s.lrMain} onClick={() => onPick(c.name)}>
                <span className={s.la} style={{ backgroundImage: `url(${imgUrl(c.avatar)})` }} />
                <span><span>{c.name}</span><small>{r.what}</small></span>
              </button>
              <em><Icon name="heart" size={10} color="#EC4899" fill="#EC4899" stroke={0} /> {r.hearts}</em>
              <button className={`${s.fol} ${on ? s.folOn : ''}`} onClick={() => toggle(r.creatorId)} aria-pressed={on}>
                {on ? 'ติดตามแล้ว' : 'ติดตาม'}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Time left until midnight in Bangkok (UTC+7), when the daily challenge rolls over. */
function useChallengeCountdown() {
  const calc = () => {
    const bkk = (Date.now() + 7 * 3600_000) % 86_400_000
    return Math.floor((86_400_000 - bkk) / 1000)
  }
  const [left, setLeft] = useState(calc)
  useEffect(() => {
    const t = setInterval(() => setLeft(calc()), 1000)
    return () => clearInterval(t)
  }, [])
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(Math.floor(left / 3600))}:${p2(Math.floor((left % 3600) / 60))}:${p2(left % 60)}`
}

function DailyChallenge() {
  const left = useChallengeCountdown()
  return (
    <section>
      <SectionHead title="✏️ โจทย์ประจำวัน" right="ส่งผลงานรับดาว" />
      <div className={s.ch}>
        <div className={s.cht}><span>วันนี้วาดอะไรดี?</span><em>เหลือ {left}</em></div>
        <b>“{CHALLENGE.prompt}”</b>
        <small>{CHALLENGE.note}</small>
        <div className={s.chf}>
          <span className={s.avs}>{CHALLENGE.avatars.map((a) => <i key={a} style={{ backgroundImage: `url(${imgUrl(creatorById(a).avatar)})` }} />)}</span>
          <small>ส่งแล้ว {CHALLENGE.joined} คน</small>
          <Link to="/sell" className={s.chb}>ร่วมสนุก</Link>
        </div>
      </div>
    </section>
  )
}

/* ---------- page ---------- */

export function Search() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const catParam = params.get('cat')
  const cat: CatKey | 'new' | null = catParam === 'new' ? 'new' : isCatKey(catParam) ? catParam : null
  const [focused, setFocused] = useState(false)
  const [toast, setToast] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => searchWorks(q, cat), [q, cat])
  const searching = q.trim() !== '' || cat !== null

  const update = (next: { q?: string; cat?: string | null }, replace = false) => {
    const p = new URLSearchParams()
    const nq = next.q ?? q
    const nc = next.cat === undefined ? cat : next.cat
    if (nq) p.set('q', nq)
    if (nc) p.set('cat', nc)
    setParams(p, { replace })
  }
  const pickQuery = (text: string) => { update({ q: text, cat: null }); inputRef.current?.blur(); window.scrollTo(0, 0) }
  const pickCat = (k: CatKey | 'new') => { update({ q: '', cat: k }); window.scrollTo(0, 0) }

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
              <span>{results.length} ชิ้น{q && cat ? ` · ใน${catLabel}` : ''}</span>
            </div>
            {results.length > 0 ? (
              <MasonryFeed items={results} />
            ) : (
              <div className={s.empty}>
                <b>ยังไม่เจอผลงานที่ตรงกับคำนี้</b>
                <p>ลองคำอื่นดูนะ หรือเลือกจากคำค้นยอดฮิต</p>
                <div className={s.sgW}>{HOT_KEYWORDS.slice(0, 6).map((k) => <button key={k} onClick={() => pickQuery(k)}>{k}</button>)}</div>
              </div>
            )}
          </>
        ) : (
          <>
            <TrendCarousel onPick={pickQuery} />
            <CategoryGroup g={GROUPS[0]} onPick={pickCat} />
            <CategoryGroup g={GROUPS[1]} onPick={pickCat} />
            <NewToday onAll={() => pickCat('new')} />
            <CategoryGroup g={GROUPS[2]} onPick={pickCat} />
            <CreatorsOfWeek onPick={pickQuery} />
            <CategoryGroup g={GROUPS[3]} onPick={pickCat} />
            <DailyChallenge />
            <section>
              <SectionHead title="ผลงานสำหรับคุณ" right="คละทุกประเภท" />
              <MasonryFeed items={PRODUCTS} />
            </section>
          </>
        )}
      </main>
      {toast && <div className={s.toast} role="status">{toast}</div>}
    </>
  )
}
