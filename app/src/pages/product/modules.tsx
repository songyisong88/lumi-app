/** Type-specific blocks of the product page (approved product-b modules). */
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { copyText, Img } from '../../components/ui'
import { toast } from '../../services/toast'
import { arr, filesOf, isPreset, licRows, on, previewSrc, previewsOf, promptOnly, str, type PreviewItem, type Spec } from '../../data/listingSpec'
import { parseSample, sampleMime, sampleOf } from '../../utils/sampleFile'
import { galleryOf } from '../../data/productExtras'
import { baht, imgUrl } from '../../data/sampleData'
import type { DetailKind, Product, ProductOption } from '../../data/types'
import { FEATURES, BRAND } from '../../config'
import s from './Product.module.css'

const PAL = ['#2B1B4F', '#5B3FA8', '#E9A86B', '#F4D9B0', '#C2416B']
const Ok = ({ children }: { children: React.ReactNode }) => <div className={s.ok}><span className="ok-ic"><Icon name="check" size={13} stroke={3} /></span>{children}</div>

type ModProps = {
  unlocked?: boolean; p: Product; L: DetailKind; spec: Spec; opts: ProductOption[]; optId?: string; setOptId: (v: string) => void; onTip: (amount?: number) => void; onTrial: () => void; onLesson: () => void
  /** Free work: show its own type's showcase, then the free-download block (owner 2026-11-03). */
  free?: boolean
}
export function Modules(props: ModProps) {
  return <>{props.L !== 'free' && <TypeModules {...props} />}{(props.free || props.L === 'free') && <FreeBlock onTip={props.onTip} />}</>
}

function FreeBlock({ onTip }: { onTip: (amount?: number) => void }) {
  return (
    <>
      <div className={s.scan} style={{ marginTop: 14 }}><Icon name="gift" size={24} color="#16A34A" /><div><b>ดาวน์โหลดฟรี ไม่ต้องจ่าย</b>ครีเอเตอร์แจกให้ใช้ · สแกนไวรัสเบื้องต้นแล้ว</div></div>
      {FEATURES.tips && <>
        <div className={s.st}>ชอบไหม? ให้ทิปเป็นกำลังใจ</div>
        <div className={s.tipr}>{[20, 50, 100].map((a) => <button key={a} className="press" onClick={() => onTip(a)}>฿{a}</button>)}<button className="press" onClick={() => onTip(0)}>อื่น ๆ</button></div>
        <p className="hint">ไม่บังคับ · ครีเอเตอร์ได้รับทิปหลังหักค่าธรรมเนียมการชำระเงิน</p>
      </>}
    </>
  )
}

/** Loads the creator's uploaded preview font; returns the CSS family once ready. */
function usePreviewFont(item: PreviewItem | undefined, key: string) {
  const [st, setSt] = useState<{ fam?: string; err?: boolean }>({})
  useEffect(() => {
    if (!item || typeof FontFace === 'undefined') return
    let live = true
    const fam = `lumi-pv-${key.replace(/[^\w-]/g, '')}`
    new FontFace(fam, `url("${previewSrc(item.url)}")`).load()
      .then((f) => { document.fonts.add(f); if (live) setSt({ fam }) })
      .catch(() => { if (live) setSt({ err: true }) })
    return () => { live = false }
  }, [item?.url, key]) // eslint-disable-line react-hooks/exhaustive-deps
  return st
}

/** Real audio preview in the approved waveform row: play/pause, progress on the bars, time left. */
/** The cover's own colours for “โทนสีของภาพนี้” (was a fixed list shown on every image). Falls back to PAL if the image can't be read. */
function usePalette(src: string) {
  const [pal, setPal] = useState<string[] | null>(null)
  useEffect(() => {
    setPal(null)
    if (!src) return
    let dead = false
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => {
      try {
        const n = 48, c = document.createElement('canvas'); c.width = n; c.height = n
        const x = c.getContext('2d', { willReadFrequently: true }); if (!x) return
        x.drawImage(im, 0, 0, n, n)
        const d = x.getImageData(0, 0, n, n).data, cnt = new Map<number, [number, number, number, number]>()
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 128) continue
          const k = ((d[i] >> 5) << 6) | ((d[i + 1] >> 5) << 3) | (d[i + 2] >> 5)
          const v = cnt.get(k) ?? [0, 0, 0, 0]; v[0] += d[i]; v[1] += d[i + 1]; v[2] += d[i + 2]; v[3]++; cnt.set(k, v)
        }
        const out: [number, number, number][] = []
        for (const [r, g, b, k] of [...cnt.values()].sort((a, b) => b[3] - a[3])) {
          const c3: [number, number, number] = [r / k, g / k, b / k]
          if (out.every((o) => Math.abs(o[0] - c3[0]) + Math.abs(o[1] - c3[1]) + Math.abs(o[2] - c3[2]) > 60)) out.push(c3)
          if (out.length === 5) break
        }
        if (!dead && out.length >= 3) setPal(out.map((o) => '#' + o.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')))
      } catch { /* tainted canvas: keep fallback */ }
    }
    im.src = src
    return () => { dead = true }
  }, [src])
  return pal
}

function WavePlayer({ src }: { src: string }) {
  const a = useRef<HTMLAudioElement>(null)
  const [play, setPlay] = useState(false)
  const [t, setT] = useState(0)
  const [d, setD] = useState(0)
  const N = 42
  const mmss = (x: number) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`
  return (
    <div className={s.wave}>
      <audio ref={a} src={src} preload="metadata" onLoadedMetadata={(e) => setD(e.currentTarget.duration || 0)} onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onPlay={() => setPlay(true)} onPause={() => setPlay(false)} onEnded={() => { setPlay(false); setT(0) }} data-preview-audio />
      <button className={s.wplay} aria-label={play ? 'หยุดตัวอย่าง' : 'เล่นตัวอย่าง'} onClick={() => { const el = a.current; if (!el) return; if (el.paused) void el.play().catch(() => toast('เล่นไฟล์ตัวอย่างไม่ได้')); else el.pause() }}>
        <Icon name={play ? 'pause' : 'play'} size={18} color="#fff" fill="#fff" />
      </button>
      <div className={s.wbars} role="slider" aria-label="ตำแหน่งที่เล่น" aria-valuemin={0} aria-valuemax={Math.round(d)} aria-valuenow={Math.round(t)} tabIndex={0}
        onClick={(e) => { const el = a.current; if (!el || !d) return; const r = e.currentTarget.getBoundingClientRect(); el.currentTime = ((e.clientX - r.left) / r.width) * d }}>
        {Array.from({ length: N }, (_, i) => <i key={i} className={d && i / N > t / d ? s.dim : ''} style={{ transform: `scaleY(${0.25 + Math.abs(Math.sin(i * 0.55)) * 0.75})` }} />)}
      </div>
      <small>{mmss(d ? d - t : 0)}</small>
    </div>
  )
}

function TypeModules({ p, L, spec, opts, optId, setOptId, onTrial, onLesson, unlocked = false, free = false }: ModProps) {
  const [fontText, setFontText] = useState('')
  const g = galleryOf(p)
  const pal = usePalette(L === 'img' && g[0] ? imgUrl(g[0]) : '')
  const pv = previewsOf(spec.previews)
  const pages = previewsOf(spec.samplePages)
  const [mdOpen, setMdOpen] = useState(false)
  const font = usePreviewFont(L === 'font' ? pv.find((x) => /font|woff|otf|ttf/i.test(x.mime + x.name)) : undefined, p.id)
  switch (L) {
    case 'img':
      return (
        <>
          <div className={s.st}>โทนสีของภาพนี้</div>
          <div className={s.sw}>{(pal ?? PAL).map((c, i) => <div key={i} style={{ background: c }} data-pal={pal ? 'image' : 'fallback'} />)}</div>
          {(on(spec.sellPrompt) || promptOnly(spec)) && <>
            <div className={s.st}>สูตรพรอมต์{promptOnly(spec) ? ' · ขายพรอมต์อย่างเดียว' : ''}</div>
            {unlocked
              ? <div className={s.blur}><button className={s.lk} onClick={() => { copyText(str(spec.prompt)); toast('คัดลอกพรอมต์แล้ว') }}><Icon name="copy" size={11} color="#fff" stroke={2.4} />คัดลอก</button>{str(spec.prompt)}</div>
              : <div className={s.blur}><span className={s.lk}><Icon name="lock" size={11} color="#fff" stroke={2.4} />{free ? 'ปลดล็อกหลังกดรับฟรี' : 'ปลดล็อกหลังซื้อ'}</span>
                {str(spec.prompt).slice(0, 48)}<em aria-hidden>{str(spec.prompt).slice(48).replace(/[^\s]/g, '•')}</em></div>}
          </>}
        </>
      )
    case 'tpl':
      return (
        <>
          {pages.length > 0 ? <>
            <div className={s.st}>หน้าตัวอย่าง {pages.length} หน้า</div>
            <div className={`hscroll ${s.canva}`} data-sample-pages>{pages.map((x, i) => <img key={i} src={previewSrc(x.url)} alt={`หน้าตัวอย่าง ${i + 1}`} className={s.pageI} loading="lazy" />)}</div>
          </> : <>
            <div className={s.st}>ตัวอย่างในชุด</div>
            <div className={`hscroll ${s.canva}`}>{[...g, ...g].slice(0, 4).map((x, i) => <Img key={i} src={x} className={s.canvaI} />)}</div>
          </>}
          {arr(spec.editable).length > 0 && <><div className={s.st}>{arr(spec.formats).includes('PDF') && arr(spec.formats).length === 1 ? 'ใช้งานยังไง' : 'แก้อะไรได้บ้าง'}</div>
          {arr(spec.editable).map((t) => <Ok key={t}>{t}</Ok>)}</>}
          {arr(spec.apps).includes('Canva') && <div className={s.scan} style={{ background: '#EAF1FF', color: '#1E40AF' }}><Icon name="link" size={20} color="#2563EB" /><div><b>ได้ลิงก์ Canva ทันทีหลังซื้อ</b>{on(spec.noPro) ? 'ผู้ขายรับรองว่าไม่มีองค์ประกอบ Pro ใช้ Canva ฟรีได้' : 'บางองค์ประกอบอาจต้องใช้ Canva Pro'}</div></div>}
        </>
      )
    case 'sw': {
      const shots = previewsOf(spec.shots)
      return (
        <>
          {shots.length > 0 && <>
            <div className={s.st}>ภาพหน้าจอ</div>
            <div className={`hscroll ${s.canva}`} data-shots={shots.length}>{shots.map((x, i) => <img key={i} src={previewSrc(x.url)} alt={`ภาพหน้าจอ ${i + 1}`} className={s.shotI} loading="lazy" />)}</div>
          </>}
          <div className={s.st}>ใช้กับเครื่องของคุณได้ไหม</div>
          <div className={s.cmpt}>
            {arr(spec.platforms).map((x) => <div key={x}><Icon name={/iOS|Android/.test(x) ? 'phone' : /เว็บ|Chrome/.test(x) ? 'globe' : 'monitor'} size={18} color="#4F46E5" />{x}<span className={s.yes}>รองรับ</span></div>)}
            <div><Icon name="box" size={18} color="#8A86A0" />{str(spec.minSpec)}<span className="muted">ขั้นต่ำ</span></div>
          </div>
          <div className={s.st}>มีอะไรใหม่</div>
          <div className={s.box}>{arr(spec.changelog).map((c) => <div key={c} className={s.ok}><Icon name="rocket" size={15} color="var(--p)" />{c}</div>)}</div>
        </>
      )
    }
    case 'bot':
      return (
        <>
          {on(spec.trial) && <>
            <div className={s.st}>ลองก่อน ไม่ต้องจ่าย</div>
            <button className={`${s.trial} press`} onClick={onTrial}><span className={s.q}><Icon name="qr" size={60} stroke={1.6} /></span><span><b>ทดลองฟรี {str(spec.trialDays)}</b><small>{/line\.me/.test(str(spec.trialLink)) ? 'สแกน QR เพื่อลองคุยกับบอทได้เลย' : 'เปิดลิงก์แล้วลองใช้ได้เลย'}</small><span className={s.g}>เปิดลิงก์ทดลอง</span></span></button>
          </>}
          {arr(spec.demo).length > 0 && <div className={s.st}>ตัวอย่างบทสนทนา</div>}
          {arr(spec.demo).length > 0 && <div className={s.demo} data-bot-demo={arr(spec.demo).length}>{arr(spec.demo).map((x, i) => <div key={i} className={i % 2 ? s.da : s.dq}>{x}</div>)}</div>}
          <div className={s.st}>ทำอะไรได้บ้าง</div>
          {arr(spec.features).map((f) => <Ok key={f}>{f}</Ok>)}
        </>
      )
    case 'course': {
      const free = parseInt(str(spec.freeLessons)) || 0
      const ebook = str(spec.sub) === 'อีบุ๊ก'
      const nf = filesOf(spec.files).length
      return (
        <>
          <div className={s.st}>{ebook ? `เนื้อหา ${arr(spec.lessons).length} บท` : `บทเรียน ${arr(spec.lessons).length} ตอน`}</div>
          {nf > 0 && <p className="hint" style={{ margin: '-4px 0 8px' }}>{ebook ? `ไฟล์อีบุ๊ก ${nf} ไฟล์ (${filesOf(spec.files).map((f) => f.name.split('.').pop()?.toUpperCase()).filter((v, i, a) => a.indexOf(v) === i).join(' / ')})` : `อัปโหลดวิดีโอและไฟล์ประกอบแล้ว ${nf} ไฟล์`}</p>}
          <div className={s.les}>{arr(spec.lessons).map((l, i) => {
            const [a, b, c] = l.split(' · ')
            const fr = i < free
            return <button key={l} className={fr ? s.fr : ''} onClick={() => fr && onLesson()}><i>{fr ? (ebook ? <Icon name="book" size={12} color="#E0620B" /> : <Icon name="play" size={12} color="#E0620B" fill="#E0620B" />) : <Icon name="lock" size={13} color="#8A86A0" />}</i><span className="ell">{b ? `${a} · ${b}` : a}</span><small>{fr ? (ebook ? 'อ่านฟรี' : 'ดูฟรี') : c}</small></button>
          })}</div>
          {ebook && pages.length > 0 && <>
            <div className={s.st}>หน้าตัวอย่าง</div>
            <div className={`hscroll ${s.canva}`} data-sample-pages>{pages.map((x, i) => <button key={i} onClick={onLesson} aria-label={`เปิดหน้าตัวอย่าง ${i + 1}`} style={{ flex: 'none' }}><img src={previewSrc(x.url)} alt="" className={s.pageI} loading="lazy" /></button>)}</div>
          </>}
          <div className={s.st}>{ebook ? 'อ่านจบแล้วทำอะไรได้' : 'เรียนจบแล้วทำอะไรได้'}</div>
          {arr(spec.outcomes).map((o) => <Ok key={o}>{o}</Ok>)}
        </>
      )
    }
    case 'font':
      return (
        <>
          {!str(spec.sub) || str(spec.sub) === 'ฟอนต์' ? <>
            <div className={s.st}>ลองพิมพ์ดู</div>
            <div className={s.spc}><div className={s.spcBig} data-font-preview={font.fam ? 'loaded' : 'app'} style={font.fam ? { fontFamily: `"${font.fam}", Prompt, sans-serif` } : undefined}>{fontText || 'ร้านขนมบ้านพิมพ์ อร่อยทุกคำ ✿'}</div>
              <input className={s.spcIn} value={fontText} onChange={(e) => setFontText(e.target.value)} placeholder="พิมพ์ชื่อร้านคุณเพื่อลองฟอนต์…" /></div>
            <p className={s.pvNote}>{font.fam ? 'ตัวอย่างนี้ใช้ไฟล์ฟอนต์ที่ครีเอเตอร์อัปไว้' : font.err ? 'โหลดไฟล์ฟอนต์ตัวอย่างไม่ได้ · ตอนนี้แสดงด้วยฟอนต์ของแอป' : pv.length ? 'กำลังโหลดฟอนต์ตัวอย่าง…' : 'ครีเอเตอร์ยังไม่ได้อัปไฟล์ตัวอย่าง · ตอนนี้แสดงด้วยฟอนต์ของแอป'}</p>
          </> : <ItemSamples spec={spec} cover={g[0] ? imgUrl(g[0]) : ''} />}
          {opts.length > 1 && <>
            <div className={s.st}>ตารางสิทธิ์ตามแบบที่ซื้อ</div>
            <table className={s.lic}><thead><tr><th>ใช้ทำ</th>{opts.map((o) => <th key={o.id}>{o.label}<br />{baht(o.price)}</th>)}</tr></thead>
              <tbody>{licRows('font').map((a, r) => {
                const full = arr(spec.licAllowed)
                return <tr key={a}><td>{a}</td>{opts.map((o, i) => { const y = i === 0 ? r === 0 : full.includes(a); return <td key={o.id} className={y ? s.yes : s.no}>{y ? '✓' : '–'}</td> })}</tr>
              })}</tbody></table>
          </>}
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
    case 'media': {
      const isAudio = (x: PreviewItem) => /^audio\//.test(x.mime) || /\.(mp3|wav|m4a|aac|ogg)$/i.test(x.name)
      const audio = pv.length ? isAudio(pv[0]) : /เพลง|เสียง/.test(str(spec.sub))
      return (
        <>
          <div className={s.st}>ตัวอย่าง{audio ? 'เสียง' : 'คลิป'}</div>
          {pv.length === 0 ? (
            <div className={s.video}><Img src={g[0]} className={s.videoImg} sizes="100vw" /><span className={s.wm}>ครีเอเตอร์ยังไม่ได้ใส่ตัวอย่างที่เล่นได้</span></div>
          ) : pv.map((x, i) => isAudio(x)
            ? <div key={i} style={{ marginTop: i ? 8 : 0 }}><WavePlayer src={previewSrc(x.url)} /></div>
            : <div key={i} className={s.video} style={{ marginTop: i ? 8 : 0 }}><video className={s.videoEl} src={previewSrc(x.url)} poster={imgUrl(g[0])} controls playsInline preload="metadata" controlsList="nodownload" data-preview-video /><span className={s.vtag}>ตัวอย่าง · ไฟล์จริงยาวเต็มและไม่มีลายน้ำ</span></div>)}
          <div className={s.scan} style={{ background: '#F5EBFF', color: '#6B21A8' }}><Icon name="shield" size={22} color="#9333EA" /><div><b>ผู้ขายรับรองว่าไม่ได้โคลนเสียงหรือหน้าคนจริง</b>สร้างด้วย {str(spec.aiTool)} · พบการละเมิด กดรายงานได้</div></div>
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
          {str(spec.skillMd) && <>
            <div className={s.st}>ตัวอย่าง SKILL.md</div>
            <div className={`${s.md} ${mdOpen ? s.mdOpen : ''}`} data-skill-md><pre>{str(spec.skillMd)}</pre>
              {!mdOpen && str(spec.skillMd).split('\n').length > 14 && <button className={s.mdMore} onClick={() => setMdOpen(true)}>อ่านต่อ</button>}</div>
            <p className={s.pvNote}>ส่วนต้นของไฟล์ที่ครีเอเตอร์เปิดให้อ่าน · ไฟล์เต็มและสคริปต์ได้หลังซื้อ</p>
          </>}
          <div className={s.st}>ทำให้ agent ทำอะไรได้</div>
          {arr(spec.features).map((f) => <Ok key={f}>{f}</Ok>)}
        </>
      )
    case 'data': {
      const cols = arr(spec.columns).map((c) => c.split(' — '))
      const smp = sampleOf(spec.sampleData)
      let tbl: ReturnType<typeof parseSample> = null
      try { tbl = smp ? parseSample(smp.name, smp.text) : null } catch { tbl = null }
      const show = tbl ? tbl.rows.slice(0, 5) : []
      return (
        <>
          {tbl && smp ? <>
            <div className={s.st}>ตัวอย่างข้อมูล {show.length} แถว</div>
            <div className={`hscroll ${s.dtWrap}`} data-sample-rows={show.length}><table className={s.dt}><thead><tr>{tbl.cols.map((k) => <th key={k}>{k}</th>)}</tr></thead>
              <tbody>{show.map((r, i) => <tr key={i}>{tbl!.cols.map((k, j) => <td key={k}>{(r[j] ?? '').slice(0, 60)}</td>)}</tr>)}</tbody></table></div>
            <p className={s.pvNote}>จากไฟล์ตัวอย่างของครีเอเตอร์ “{smp.name}” · {smp.rows} แถว{smp.total > smp.rows ? ` (ตัดจาก ${smp.total} แถว)` : ''}</p>
          </> : <>
            <div className={s.st}>ตัวอย่างข้อมูล</div>
            <p className={s.pvNote} data-sample-rows="0">ครีเอเตอร์ยังไม่ได้อัปไฟล์ตัวอย่าง · ดูโครงสร้างจากรายการคอลัมน์ด้านล่าง</p>
          </>}
          <div className={s.st}>คอลัมน์</div>
          <div className={s.tree}>{cols.map(([k, d]) => <div key={k}><Icon name="hash" size={14} color="#1D4ED8" /><code>{k}</code><span>{d}</span></div>)}</div>
          <div className={s.st}>ที่มาของข้อมูล</div>
          <p className={s.desc}>{str(spec.source)}</p>
          <div className={s.scan}><Icon name="shield" size={22} color="#16A34A" /><div><b>ผู้ขายรับรอง: ไม่มีข้อมูลส่วนบุคคล · มีสิทธิ์เผยแพร่</b>ผ่านการตรวจโดยทีม {BRAND} ก่อนขึ้นขาย · ถ้าพบว่าผิดกฎภายหลัง {BRAND} ลบได้</div></div>
          {filesOf(spec.files).length > 0 && <p className="hint">ไฟล์: {filesOf(spec.files).map((f) => `${f.name} (${f.size})`).join(', ')}</p>}
          {smp && <button className="btn btn-o btn-sm" style={{ marginTop: 10 }} data-sample-download onClick={() => {
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([/\.csv$/i.test(smp.name) ? '\uFEFF' + smp.text : smp.text], { type: `${sampleMime(smp.name)};charset=utf-8` }))
            a.download = smp.name
            a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
            toast(`ดาวน์โหลดตัวอย่าง “${smp.name}” แล้ว`)
          }}><Icon name="download" size={15} />ดาวน์โหลดตัวอย่างฟรี</button>}
        </>
      )
    }
  }
}

/** Sticker / icon / brush sets: each uploaded piece. Presets: before/after pairs. No samples: the whole cover, never a crop. */
function ItemSamples({ spec, cover }: { spec: Spec; cover: string }) {
  const items = previewsOf(spec.itemSamples)
  const preset = isPreset(spec)
  const head = <div className={s.st}>ในชุดนี้มี {str(spec.count)}</div>
  if (!items.length) return <>{head}<div className={s.items} data-item-samples="0">{cover && <img src={cover} alt="ภาพปก" className={s.itemCover} />}</div>
    <p className={s.pvNote}>ครีเอเตอร์ยังไม่ได้อัปภาพตัวอย่างทีละชิ้น · ตอนนี้แสดงภาพปก</p></>
  if (preset) {
    const pairs = Array.from({ length: Math.ceil(items.length / 2) }, (_, i) => items.slice(i * 2, i * 2 + 2))
    return <>{head}<div className={s.pairs} data-item-samples={items.length}>{pairs.map((pr, i) => <div key={i} className={s.pair}>{pr.map((x, j) => <figure key={j}><img src={previewSrc(x.url)} alt={`${pr.length === 2 ? (j ? 'หลัง' : 'ก่อน') : 'ตัวอย่าง'} ${i + 1}`} loading="lazy" /><figcaption>{pr.length === 2 ? (j ? 'หลัง' : 'ก่อน') : 'ตัวอย่าง'}</figcaption></figure>)}</div>)}</div>
      <p className={s.pvNote}>ภาพก่อน/หลังใส่พรีเซ็ตที่ครีเอเตอร์อัปไว้</p></>
  }
  return <>{head}<div className={s.items} data-item-samples={items.length}>{items.map((x, i) => <img key={i} src={previewSrc(x.url)} alt={`ชิ้นที่ ${i + 1}`} loading="lazy" />)}</div>
    <p className={s.pvNote}>ภาพตัวอย่างทีละชิ้นที่ครีเอเตอร์อัปไว้ · ไฟล์จริงความละเอียดเต็ม{/PNG/.test(str(spec.sub)) ? ' พื้นใส' : ''}</p></>
}
