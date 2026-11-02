/** MOCKUP ONLY (local branch fb-community-mockups, never deployed, no server writes).
 *  Facebook-style community (feed, reactions, composer, @mentions, comments, groups) and
 *  Instagram-style stories (pick photo/video, editor with text/stickers/optional product link, viewer, viewers list).
 *  Each screen is a static picture at #/fbmock/<key> for 390x844 before/after previews. */
import { useParams } from 'react-router-dom'
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { HeaderActions } from '../components/Header'
import { Av, Img, TopBar } from '../components/ui'
import { ROOMS } from '../data/appSeed'
import { heroOf } from '../data/productExtras'
import { baht, creatorById, imgUrl, productById } from '../data/sampleData'
import { TAG_COLOR } from '../pages/community/PostCard'
import s from './FbMock.module.css'

const bg = (f: string): CSSProperties => ({ backgroundImage: `url(${imgUrl(f)})` })
const av = (id: string) => creatorById(id).avatar
const ME = 'fasai'
export const REACTIONS = [
  { k: 'like', e: '❤️', l: 'ถูกใจ', c: '#E8457E' }, { k: 'love', e: '😍', l: 'ชอบมาก', c: '#E8457E' },
  { k: 'haha', e: '😆', l: 'ฮา', c: '#D97706' }, { k: 'wow', e: '😮', l: 'ว้าว', c: '#D97706' },
  { k: 'fire', e: '🔥', l: 'ปังมาก', c: '#EA580C' }, { k: 'idea', e: '💡', l: 'มีประโยชน์', c: '#B45309' },
]

function Tabs({ on }: { on: string }) {
  return <div className={s.tabs}>{['สำหรับคุณ', 'ติดตาม', 'กลุ่ม', 'ความรู้'].map((t) => <button key={t} className={t === on ? s.on : ''}>{t}</button>)}</div>
}
function Head() { return <TopBar back={false} title="ชุมชน" right={<HeaderActions search />} /> }

function Composer({ room }: { room?: string }) {
  return <div className={s.card} style={{ marginTop: 0 }}>
    <div className={s.cmp}><Av src={av(ME)} size={40} /><span className={s.cmpPill}>{room ? 'เขียนอะไรสักหน่อยในกลุ่มนี้…' : 'คุณกำลังคิดอะไรอยู่?'}</span><Icon name="image" size={24} color="#16A34A" /></div>
    <div className={s.cmpRow}><span><span className={s.emo}>🖼️</span>รูป/วิดีโอ</span><span><span className={s.emo}>🏷️</span>แท็กผลงาน</span><span><span className={s.emo}>✨</span>พรอมต์</span></div>
  </div>
}

function StoryCards() {
  const list = [['mint', 'g_poster.jpg'], ['nova', 'g_tuktuk.jpg'], ['kenji', 'c_app.jpg']]
  return <div className={s.stc}>
    <div className={`${s.sc} ${s.scMe}`}><div className={s.scMeTop} style={bg(av(ME))} /><span className={s.plus}><Icon name="plus" size={18} color="#fff" stroke={2.6} /></span><b>สร้างสตอรี่</b></div>
    {list.map(([id, f]) => <div key={id} className={s.sc} style={bg(f)}><span className={s.scAv}><span style={bg(av(id))} /></span><b>{creatorById(id).name}</b></div>)}
  </div>
}

type PostSpec = { author: string; ago: string; tag: string; text: ReactNode; imgs: string[]; prod?: string; rx: string[]; n: string; cm: number; sh: number; group?: string; follow?: boolean }
const P1: PostSpec = { author: 'nova', ago: '40 นาที', tag: 'โชว์ผลงาน', text: <>ลองทำชุดภาพโปรโมตตุ๊กตุ๊กดินปั้น 3 ภาพ ใช้เวลาแค่ 20 นาที 🛺✨ ขอบคุณ <em>@ฟ้าใส ครีเอท</em> ที่แนะนำเรื่องแสงครับ <em>#ภาพAI</em> <em>#ตุ๊กตุ๊ก</em> <i>…ดูเพิ่มเติม</i></>, imgs: ['g_tuktuk.jpg', 'g_poster.jpg', 'thaitea.jpg'], prod: 'p09', rx: ['❤️', '😍', '🔥'], n: '248', cm: 12, sh: 3, follow: true }
const P2: PostSpec = { author: 'kenji', ago: '5 ชม.', tag: 'เบื้องหลัง', text: <>เบื้องหลังแอปจองคิวร้านเสริมสวย ทำ 2 สัปดาห์ ส่วนที่ยากสุดคือปฏิทินวันหยุดร้าน 😅 ใครทำแอปอยู่มาแลกเปลี่ยนกันครับ</>, imgs: ['c_app.jpg', 'c_software.jpg'], rx: ['💡', '❤️'], n: '136', cm: 4, sh: 1, group: 'code' }

function Post({ p, react, reacted, coach }: { p: PostSpec; react?: boolean; reacted?: boolean; coach?: boolean }) {
  const a = creatorById(p.author)
  const [tc, tb] = TAG_COLOR[p.tag] ?? ['#6C2BD9', '#F3ECFF']
  const pr = p.prod ? productById(p.prod) : undefined
  const g = p.group ? ROOMS.find((r) => r.id === p.group) : undefined
  return <article className={s.card}>
    <div className={s.ph}>
      {g ? <span className={s.gav}><span style={{ background: g.bg }}><Icon name={g.icon} size={22} color={g.color} /></span><Av src={a.avatar} size={22} /></span> : <Av src={a.avatar} size={42} />}
      <div className={s.pm}>
        <b>{g ? g.name : a.name}{!g && p.follow && <> · <a>ติดตาม</a></>}</b>
        <small>{g && <>{a.name} · </>}{p.ago} · <Icon name="globe" size={12} /> · <span className={s.tag} style={{ color: tc, background: tb }}>{p.tag}</span></small>
      </div>
      <span className={s.ib}><Icon name="dots" size={20} /></span><span className={s.ib}><Icon name="x" size={20} /></span>
    </div>
    <div className={s.tx}>{p.text}</div>
    {p.imgs.length > 0 && <div className={`${s.imgs} ${s['g' + Math.min(p.imgs.length, 3)]}`}>{p.imgs.slice(0, 3).map((x) => <Img key={x} src={x} eager />)}</div>}
    {pr && <div className={s.prod}><Img src={heroOf(pr)} className={s.prodI} /><span className="grow"><b className="ell">{pr.title}</b><small>ผลงานในโพสต์ · {pr.price ? baht(pr.price) : 'ฟรี'}</small></span><span className="btn btn-xs btn-p">{pr.price ? 'ดูผลงาน' : 'รับฟรี'}</span></div>}
    <div className={s.cnt}><span className={s.rx}>{(reacted ? ['🔥', ...p.rx.filter((x) => x !== '🔥')] : p.rx).map((e) => <i key={e}>{e}</i>)}<span>{reacted ? 'คุณและคนอื่นอีก 248 คน' : p.n}</span></span><span>{p.cm} ความคิดเห็น · {p.sh} แชร์</span></div>
    <div className={s.acts} style={{ position: 'relative' }}>
      {react && <div className={s.dock}>{REACTIONS.map((r) => <span key={r.k} data-l={r.l} className={r.k === 'fire' ? s.hov : ''}>{r.e}</span>)}</div>}
      <button className={reacted ? s.on : ''} style={reacted ? { color: '#EA580C' } : undefined}>
        {reacted ? <><span className={s.emo}>🔥</span>ปังมาก<span className={s.burst}>{[[-30, -26, '🔥'], [8, -40, '✨'], [30, -22, '🔥'], [-8, -54, '✨']].map(([x, y, e], i) => <i key={i} style={{ transform: `translate(${x}px,${y}px)` }}>{e}</i>)}</span></>
          : <><Icon name="heart" size={20} />ถูกใจ</>}
      </button>
      <button><Icon name="comment" size={20} />แสดงความคิดเห็น</button>
      <button><Icon name="share" size={20} />แชร์</button>
    </div>
    {coach && <div className={s.coach}><span className={s.emo}>👆</span>กดค้างที่ “ถูกใจ” เพื่อเลือกอีโมจิ · แตะครั้งเดียว = ❤️ ถูกใจ</div>}
    {!react && <div className={s.cprev}>
      <small>ดูความคิดเห็นทั้ง {p.cm} รายการ</small>
      <div className={s.cm} style={{ padding: 0 }}><Av src={av('mint')} size={28} /><div className={s.cmb}><span className={s.bub}><b>มิ้นท์ สตูดิโอ</b><p>สีพาสเทลสวยมากค่ะ ขอสูตรแสงด้วย 🙏</p></span></div></div>
      <div className={s.cinMini}><Av src={av(ME)} size={28} /><span>เขียนความคิดเห็น… พิมพ์ @ เพื่อแท็กเพื่อน</span></div>
    </div>}
  </article>
}

function Feed({ react, reacted }: { react?: boolean; reacted?: boolean }) {
  return <div className={s.pg}><Head /><Tabs on="สำหรับคุณ" /><Composer />{!react && !reacted && <StoryCards />}<Post p={react || reacted ? { ...P1, imgs: ['g_tuktuk.jpg'], prod: undefined } : P1} react={react} reacted={reacted} coach={react} /><Post p={P2} /></div>
}

function Compose({ mention }: { mention?: boolean }) {
  return <div className={`${s.white}`} style={{ minHeight: '100dvh', position: 'relative' }}>
    <TopBar title="สร้างโพสต์" center right={<span className={`btn btn-sm ${mention ? 'btn-p' : ''}`} style={mention ? undefined : { background: '#EEEAF5', color: '#A9A4BA' }}>โพสต์</span>} />
    <div className={s.ctop}><Av src={av(ME)} size={44} /><div><b>{creatorById(ME).name}</b><div className={s.aud}><span><Icon name="globe" size={12} />สาธารณะ ▾</span><span><Icon name="users" size={12} />{mention ? 'ห้องภาพ AI' : 'ฟีดทั่วไป'} ▾</span><span>🏷️ {mention ? 'โชว์ผลงาน' : 'ประเภทโพสต์'} ▾</span></div></div></div>
    {mention ? <>
      <div className={s.cta}>ชุดภาพบัวสีน้ำชุดใหม่ ได้ไอเดียจาก <em>@NOVA Lab</em> ขอบคุณ @มิ้<span className={s.caret} /></div>
      <div className={s.ment}><small>แท็กคน · พิมพ์ชื่อต่อเพื่อค้นหา</small>{[['mint', 'คุณติดตาม · ครีเอเตอร์เทมเพลต'], ['somjai', 'เคยคอมเมนต์โพสต์ของคุณ'], ['pim', 'อยู่ในห้องภาพ AI']].map(([id, d], i) => <div key={id} className={`${s.mrow} ${i === 0 ? s.on : ''}`}><Av src={av(id)} size={36} /><span><b>{creatorById(id).name}</b><small>{d}</small></span></div>)}</div>
      <div style={{ padding: '14px 16px 0' }}><Img src="g_lotus.jpg" ratio="4/3" style={{ borderRadius: 12 }} eager /></div>
      <div className={s.toolbar}><b>เพิ่มลงในโพสต์</b><span>🖼️ 👤 🏷️ 😊 ✨</span></div>
    </> : <>
      <div className={`${s.cta} ${s.ph0}`}>คุณกำลังคิดอะไรอยู่?</div>
      <div className={s.sheetL}><div className={s.grab} />
        {[['🖼️', 'รูปภาพ/วิดีโอ'], ['👤', 'แท็กคน (@)'], ['🏷️', 'แท็กผลงาน · คนอ่านกดดูได้เลย'], ['😊', 'ความรู้สึก/กิจกรรม'], ['✨', 'ใส่พรอมต์ที่ใช้'], ['👥', 'โพสต์ในกลุ่ม'], ['❓', 'ถามชุมชน (ถาม-ตอบ)'], ['🎁', 'แจกฟรี']].map(([e, l]) => <div key={l} className={s.opt}><span className={s.oi}>{e}</span>{l}</div>)}
      </div>
    </>}
  </div>
}

function Comments() {
  const C = ({ id, t, ago, rx, n, rep }: { id: string; t: ReactNode; ago: string; rx?: string; n?: number; rep?: boolean }) => (
    <div className={`${s.cm} ${rep ? s.rep : ''}`}><Av src={av(id)} size={rep ? 28 : 36} /><div className={s.cmb}><span className={s.bub}><b>{creatorById(id).name}{id === 'nova' && <span className="pill" style={{ fontSize: 10.5 }}>ผู้โพสต์</span>}</b><p>{t}</p>{rx && <span className={s.brx}>{rx} {n}</span>}</span><div className={s.cma}><span>{ago}</span><span>ถูกใจ</span><span>ตอบกลับ</span></div></div></div>)
  return <div className={s.white} style={{ minHeight: '100dvh', position: 'relative' }}>
    <TopBar title="โพสต์ของ NOVA Lab" />
    <div className={s.ph} style={{ paddingTop: 4 }}><Av src={av('nova')} size={40} /><div className={s.pm}><b>NOVA Lab</b><small>40 นาที · <Icon name="globe" size={12} /></small></div></div>
    <div className={s.tx}>ลองทำชุดภาพโปรโมตตุ๊กตุ๊กดินปั้น 3 ภาพ ใช้เวลาแค่ 20 นาที 🛺✨</div>
    <div className={s.cnt}><span className={s.rx}><i>❤️</i><i>😍</i><i>🔥</i><span>248</span></span><span>12 ความคิดเห็น · 3 แชร์</span></div>
    <div className={s.acts}><button><Icon name="heart" size={20} />ถูกใจ</button><button><Icon name="comment" size={20} />แสดงความคิดเห็น</button><button><Icon name="share" size={20} />แชร์</button></div>
    <div className={s.csort}>ความคิดเห็นที่เกี่ยวข้องที่สุด <Icon name="down" size={14} /></div>
    <C id="mint" t="สีพาสเทลสวยมากค่ะ ขอสูตรแสงด้วย 🙏" ago="32 นาที" rx="❤️😍" n={18} />
    <C id="nova" rep t={<><em>@มิ้นท์ สตูดิโอ</em> ใส่ไว้ในพรอมต์ท้ายโพสต์แล้วครับ ใช้ soft studio light</>} ago="30 นาที" rx="❤️" n={6} />
    <div className={s.more}>↳ ดูการตอบกลับอีก 3 รายการ</div>
    <C id="ton" t="ใช้ทำปกโพสต์ร้านค้าได้ไหมครับ" ago="20 นาที" rx="💡" n={2} />
    <div className={s.cbar}><small><span>กำลังตอบกลับ <b>Ton Data</b></span><span>ยกเลิก</span></small>
      <div className={s.ment} style={{ margin: '0 0 8px' }}><small>แท็กคน</small>{[['toy', 'อยู่ในโพสต์นี้'], ['pim', 'คุณติดตาม']].map(([id, d], i) => <div key={id} className={`${s.mrow} ${i === 0 ? s.on : ''}`}><Av src={av(id)} size={32} /><span><b>{creatorById(id).name}</b><small>{d}</small></span></div>)}</div>
      <div className={s.cin}><Av src={av(ME)} size={32} /><span className={s.cinT}><em>@Ton Data</em>ได้ครับ ถาม @To<span className={s.caret} /></span><Icon name="send" size={22} color="var(--p)" /></div></div>
  </div>
}

function Groups() {
  const mine = ROOMS.slice(0, 4)
  return <div className={s.pg}><Head /><Tabs on="กลุ่ม" />
    <div className={s.gpills}><span className={s.on}>กลุ่มของคุณ</span><span>ค้นพบ</span><span><Icon name="plus" size={14} />สร้างกลุ่ม</span></div>
    <div className={s.gmine}>{mine.map((r, i) => <span key={r.id}><span className={s.gico} style={{ background: r.bg }}><Icon name={r.icon} size={26} color={r.color} />{i < 2 && <i />}</span>{r.name}</span>)}</div>
    <div className={s.card}><div className={s.secH}>กลุ่มแนะนำสำหรับคุณ<a>ดูทั้งหมด</a></div>
      <div className={s.sugg}>{[['sticker', 'g_anime.jpg'], ['bot', 'c_bot.jpg']].map(([id, f]) => { const r = ROOMS.find((x) => x.id === id)!; return <div key={id} className={s.gcard}><Img src={f} eager /><div><b>{r.name}</b><small>กลุ่มสาธารณะ · {(r.members / 1000).toFixed(1)}K สมาชิก</small><span className="btn btn-sm btn-p btn-block">+ เข้าร่วม</span></div></div> })}</div></div>
    <div className={s.secH} style={{ marginTop: 8, paddingBottom: 0 }}>โพสต์ล่าสุดจากกลุ่มของคุณ</div>
    <Post p={P2} />
  </div>
}

function Group() {
  const r = ROOMS[0]
  return <div className={s.pg} style={{ background: '#F0EEF5' }}>
    <div className={s.gcov}><Img src="g_island.jpg" eager /><span style={{ position: 'absolute', top: 10, left: 10, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={20} color="#fff" /></span></div>
    <div className={s.gbody}><h1>{r.name}</h1><small><Icon name="globe" size={13} />กลุ่มสาธารณะ · 12.4K สมาชิก · 38 โพสต์วันนี้</small>
      <div className={s.avs}>{['mint', 'nova', 'pim', 'toy', 'ton', 'kenji'].map((id) => <Av key={id} src={av(id)} size={30} />)}</div>
      <div className={s.gbtns}><span className="btn btn-sm" style={{ background: '#F3ECFF', color: 'var(--p)' }}>✓ เข้าร่วมแล้ว ▾</span><span className="btn btn-sm btn-p">+ เชิญเพื่อน</span></div></div>
    <div className={s.gtabs}>{['สำหรับคุณ', 'เกี่ยวกับ', 'สมาชิก', 'รูปภาพ', 'ผลงาน'].map((t, i) => <span key={t} className={i === 0 ? s.on : ''}>{t}</span>)}</div>
    <div style={{ marginTop: 8 }}><Composer room="ai" /></div>
    <div className={s.pin}><small>📌 ประกาศจากแอดมิน</small><p>แชร์ภาพ AI ได้ทุกสไตล์ ใส่พรอมต์ช่วยเพื่อน ๆ ด้วยนะ ห้ามโพสต์ขายซ้ำ ⭐</p></div>
    <Post p={{ ...P1, follow: false, text: 'ลองทำชุดภาพโปรโมตตุ๊กตุ๊กดินปั้น 3 ภาพ ใช้เวลาแค่ 20 นาที 🛺✨', imgs: ['g_tuktuk.jpg'] }} />
  </div>
}

function Notif() {
  const N = ({ id, e, ebg, t, ago, un }: { id: string; e: string; ebg: string; t: ReactNode; ago: string; un?: boolean }) => <div className={`${s.nt} ${un ? s.unread : ''}`}><span className={s.ntAv}><Av src={av(id)} size={52} /><i style={{ background: ebg }}>{e}</i></span><div><p>{t}</p><small style={un ? undefined : { color: 'var(--mut)' }}>{ago}</small></div></div>
  return <div className={s.white} style={{ minHeight: '100dvh' }}><TopBar back={false} title="การแจ้งเตือน" />
    <div className={s.gpills} style={{ paddingTop: 4 }}><span className={s.on}>ทั้งหมด</span><span>กล่าวถึงคุณ</span><span>กลุ่ม</span><span>ออเดอร์</span></div>
    <N un id="nova" e="@" ebg="#6C2BD9" t={<><b>NOVA Lab</b> กล่าวถึงคุณในโพสต์: “ขอบคุณ @ฟ้าใส ครีเอท ที่แนะนำเรื่องแสง…”</>} ago="40 นาที" />
    <N un id="mint" e="🔥" ebg="#FFEDD5" t={<><b>มิ้นท์ สตูดิโอ</b> และคนอื่นอีก 23 คน แสดงความรู้สึกต่อโพสต์ของคุณ</>} ago="1 ชม." />
    <N id="ton" e="💬" ebg="#E2F6F2" t={<><b>Ton Data</b> ตอบกลับความคิดเห็นของคุณใน <b>ห้องภาพ AI</b></>} ago="3 ชม." />
    <N id="pim" e="👥" ebg="#EAF1FF" t={<><b>พิมพ์ดาว</b> เชิญคุณเข้ากลุ่ม <b>คนขายสติกเกอร์ LINE</b></>} ago="เมื่อวาน" />
  </div>
}

/* ---------------- stories (Instagram-like) ---------------- */
function HomeRings() {
  const list = [['mint', false], ['nova', false], ['kenji', false], ['pim', true]] as const
  return <div className={s.ringRow}>
    <span className={`${s.rg} ${s.me}`}><span><span className={s.pic} style={bg(av(ME))} /><span className={s.add}><Icon name="plus" size={13} color="#fff" stroke={3} /></span></span><b>สตอรี่ของคุณ</b></span>
    {list.map(([id, seen]) => <span key={id} className={`${s.rg} ${seen ? s.seen : ''}`}><span><span className={s.pic} style={bg(av(id))} /></span><b>{creatorById(id).name}</b></span>)}
  </div>
}

function Pick() {
  const files = ['g_lotus.jpg', 'g_tuktuk.jpg', 'cafe.jpg', 'g_poster.jpg', 'mascot.jpg', 'coffee.jpg', 'g_anime.jpg', 'shiba.jpg']
  return <div className={s.pick}>
    <div className={s.pickH}><Icon name="x" size={24} color="#fff" /><b>เพิ่มลงสตอรี่</b><Icon name="gear" size={22} color="#fff" /></div>
    <div className={s.pickModes}><span style={{ background: 'linear-gradient(135deg,#7B2FF2,#F0508A)' }}><b style={{ fontSize: 26 }}>Aa</b>ข้อความ</span><span style={{ background: '#2C2840' }}><Icon name="camera" size={26} color="#fff" />ถ่ายรูป/วิดีโอ</span><span style={{ background: '#2C2840' }}><span style={{ fontSize: 24 }}>🎵</span>เพลง</span></div>
    <div className={s.pickBar}>ล่าสุด ▾<small>⧉ เลือกหลายรายการ</small></div>
    <div className={s.grid}>
      <span className={s.camBtn}><Icon name="camera" size={28} color="#fff" />กล้อง</span>
      {files.map((f, i) => <span key={f} style={bg(f)}>{i === 1 && <i>0:12</i>}{i === 4 && <i>0:08</i>}<b className={`${s.sel} ${i < 2 ? s.on : ''}`}>{i < 2 ? i + 1 : ''}</b></span>)}
    </div>
    <span className={s.next}>ถัดไป (2) <Icon name="arrow" size={18} color="#fff" /></span>
  </div>
}

function Editor({ sheet }: { sheet?: 'stk' | 'prod' }) {
  return <div className={s.dark}>
    <div className={`${s.media} ${s.fullh}`} style={bg('g_lotus.jpg')} /><div className={s.shadeT} />
    <div className={s.etop}><span className={s.vbtn}><Icon name="x" size={26} color="#fff" /></span><span style={{ fontWeight: 700, fontSize: 13, padding: '6px 12px', borderRadius: 99, background: 'rgba(0,0,0,.35)' }}>1 / 2 ▸</span></div>
    {!sheet && <div className={s.etools}>{[['Aa', 'ข้อความ'], ['😊', 'สติกเกอร์'], ['@', 'แท็กคน'], ['🔗', 'ลิงก์ผลงาน'], ['✨', 'ฟิลเตอร์'], ['✏️', 'วาด'], ['🎵', 'เพลง']].map(([e, l]) => <span key={l}>{l}<i>{e}</i></span>)}</div>}
    <div className={`${s.etext} ${!sheet ? s.sel : ''}`}>ชุดใหม่มาแล้ว 🌸</div>
    <div className={s.estk}>⏰ เปิดขาย 20:00</div>
    <div className={s.ementi}>@มิ้นท์ สตูดิโอ</div>
    {!sheet && <>
      <div className={s.elink}>🛍️ ดูสินค้า · ภาพบัวชมพูสีน้ำ</div>
      <div className={s.gest}><i>🤏</i>ลากเพื่อย้าย · ถ่างสองนิ้วเพื่อซูม/หมุน<span style={{ opacity: .8, fontWeight: 500 }}>ลากลงถังเพื่อลบ</span></div>
      <div className={s.ebot}><span className={s.pillD}><Av src={av(ME)} size={26} />สตอรี่ของคุณ</span><span className={s.share}>แชร์ไปยังสตอรี่ <Icon name="arrow" size={18} /></span></div>
    </>}
    {sheet === 'stk' && <div className={s.dsheet}><div className={s.grab} />
      <div className={s.dsearch}><Icon name="search" size={18} color="#aaa" />ค้นหาสติกเกอร์</div>
      <div className={s.stkg}>{[['🔗', 'ลิงก์ผลงาน', 1], ['@', 'กล่าวถึง'], ['#', 'แฮชแท็ก'], ['📊', 'โพล'], ['❓', 'ถามคำถาม'], ['⏰', 'นับถอยหลัง'], ['📍', 'สถานที่'], ['🎁', 'ของฟรี'], ['🕒', 'เวลา']].map(([e, l, h]) => <span key={l as string} className={h ? s.hl : ''}>{e} {l}</span>)}</div>
      <div className={s.emog}>{'🌸✨🔥💜😍🎉👀💯🛺☕🎨🙏'.match(/\p{Extended_Pictographic}/gu)!.map((e, i) => <span key={i}>{e}</span>)}</div>
    </div>}
    {sheet === 'prod' && <div className={s.dsheet} style={{ top: 170 }}><div className={s.grab} />
      <b style={{ display: 'block', fontSize: 16, marginBottom: 4 }}>ลิงก์ไปที่ผลงานของคุณ</b><small style={{ color: '#aaa', fontSize: 12.5 }}>ไม่ใส่ก็ได้ · คนดูกดแล้วไปหน้าผลงานบน LUMI</small>
      <div className={s.lblPick}>{['ดูสินค้า', 'ดูผลงาน', 'รับฟรี', 'จ้างเลย'].map((l, i) => <span key={l} className={i === 0 ? s.on : ''}>{l}</span>)}</div>
      <div className={s.dsearch}><Icon name="search" size={18} color="#aaa" />ค้นหาผลงานของฉัน</div>
      {['p01', 'p04', 'p09', 'p07'].map((id, i) => { const p = productById(id); return p && <div key={id} className={s.prow}><Img src={heroOf(p)} /><span style={{ minWidth: 0 }}><b className="ell">{p.title}</b><small>{p.price ? baht(p.price) : 'ฟรี'}</small></span><span className={`${s.ck} ${i === 0 ? s.on : ''}`}>{i === 0 && <Icon name="check" size={14} color="#fff" stroke={3} />}</span></div> })}
      <span className="btn btn-p btn-block" style={{ marginTop: 14 }}>ใส่ลิงก์</span>
    </div>}
  </div>
}

function Viewer({ link = true, hint, mine }: { link?: boolean; hint?: boolean; mine?: boolean }) {
  const who = mine ? ME : 'mint'
  const p = productById('p07')
  const f = mine ? 'g_lotus.jpg' : link ? 'cafe.jpg' : 'coffee.jpg'
  return <div className={s.dark}>
    <div className={s.media} style={bg(f)}><div className={s.shadeT} /><div className={s.shadeB} /></div>
    <div className={s.bars}>{[1, mine ? 0.4 : 0.55, 0].map((v, i) => <i key={i}><b style={{ width: `${v * 100}%` }} /></i>)}</div>
    <div className={s.vh}><span style={bg(av(who))} /><span className="grow"><b>{mine ? 'สตอรี่ของคุณ' : creatorById(who).name}</b><small>{mine ? '6 ชม.' : '1 ชม.'}</small></span><span className={s.vbtn}><Icon name="dots" size={22} color="#fff" /></span><span className={s.vbtn}><Icon name="x" size={24} color="#fff" /></span></div>
    {!mine && link && p && <><div className={s.estk} style={{ top: 230, left: 'auto', right: 40 }}>เทมเพลตใหม่ 30 แบบ ☕</div>
      <span className={s.linkPill} style={{ bottom: 150 }}><Img src={heroOf(p)} /><span>🛍️ ดูสินค้า<small>{p.title.slice(0, 22)}… · {baht(p.price)}</small></span><Icon name="chev" size={16} /></span></>}
    {!mine && !link && <div className={s.etext} style={{ top: 360, left: 60, transform: 'rotate(3deg)' }}>เบื้องหลังวันนี้ ☕</div>}
    {!mine && <>
      {!hint && link && <div className={s.float}><i>❤️</i><i style={{ fontSize: 22 }}>❤️</i><i style={{ fontSize: 16 }}>❤️</i></div>}
      <div className={s.reply}><span>ส่งข้อความถึง {creatorById(who).name}…</span><span style={{ fontSize: 26 }}>❤️</span><Icon name="send" size={26} color="#fff" /></div>
      {!link && <div className={s.qr} style={{ bottom: 76 }}>{['😍', '😆', '😮', '🔥', '👏', '🙏'].map((e) => <span key={e}>{e}</span>)}</div>}
    </>}
    {hint && <><div className={s.hint}><div><i>👈</i>แตะซ้าย<br />ย้อนกลับ</div><div><i>✋</i>กดค้าง<br />หยุดชั่วคราว</div><div><i>👉</i>แตะขวา<br />ถัดไป</div></div><span className={s.hintOk}>เข้าใจแล้ว</span>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center', zIndex: 4, fontSize: 13.5, fontWeight: 600 }}>ปัดซ้าย/ขวา = เปลี่ยนคน · ปัดลง = ปิด</div></>}
    {mine && <>
      <div className={s.thumbs}><span style={bg('g_tuktuk.jpg')} /><span className={s.on} style={bg('g_lotus.jpg')} /></div>
      <div className={s.vsheet}><div className={s.grab} />
        <div className={s.vsH}><span><b>👁 128</b>คนดู</span><span><b>❤️ 24</b>ถูกใจ</span><span><b>💬 5</b>ตอบกลับ</span><span><b>🛍️ 17</b>กดดูสินค้า</span></div>
        {[['mint', '6 นาทีที่แล้ว', '❤️'], ['nova', '12 นาทีที่แล้ว', '😍'], ['somjai', '20 นาทีที่แล้ว · กดดูสินค้า', '🛍️'], ['ton', '1 ชม.ที่แล้ว', '']].map(([id, t, e]) => <div key={id} className={s.vrow}><Av src={av(id)} size={40} /><span><b>{creatorById(id).name}</b><small>{t}</small></span><span className={s.e}>{e}</span></div>)}
        <div className={s.exp}><Icon name="clock" size={14} />หายไปใน 18 ชม. · กด ••• เพื่อเก็บเป็นไฮไลต์หรือลบ</div>
      </div></>}
  </div>
}

export function FbMock() {
  const { screen = '' } = useParams()
  switch (screen) {
    case 'c_feed': return <Feed />
    case 'c_react': return <Feed react />
    case 'c_reacted': return <Feed reacted />
    case 'c_compose': return <Compose />
    case 'c_mention': return <Compose mention />
    case 'c_comments': return <Comments />
    case 'c_groups': return <Groups />
    case 'c_group': return <Group />
    case 'c_notif': return <Notif />
    case 's_pick': return <Pick />
    case 's_edit': return <Editor />
    case 's_stickers': return <Editor sheet="stk" />
    case 's_product': return <Editor sheet="prod" />
    case 's_view': return <Viewer />
    case 's_view_plain': return <Viewer link={false} />
    case 's_hint': return <Viewer hint />
    case 's_mine': return <Viewer mine />
    default: return <div style={{ padding: 20 }}>fbmock: unknown screen</div>
  }
}
/** Home stories row, Instagram style ("สตอรี่ของคุณ" first). Shown only at #/fbmock/s_home. */
export const FbHomeRings = HomeRings
