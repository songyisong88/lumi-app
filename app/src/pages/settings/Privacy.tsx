// Instagram/Facebook-style privacy settings: private account, activity status, who can comment/tag/mention/reply,
// hidden words, blocked / restricted / muted, close friends, hide story from, follow requests.
// Real accounts save to Supabase (privacy_settings, profiles.is_private, user_blocks, close_friends, story_hide); RLS enforces them.
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Sheet, Toggle, TopBar } from '../../components/ui'
import type { PrivacySettings, Who } from '../../data/appTypes'
import { ME, creatorById } from '../../data/sampleData'
import { community } from '../../services/api'
import { cloudOn } from '../../services/cloud'
import { useDb } from '../../services/db'
import { DEFAULT_PRIVACY, answerRequest, followRequests, loadBlocks, loadList, loadPrivacy, savePrivacy, setBlock, toggleList, who } from '../../services/social'
import { toast } from '../../services/toast'

const OPTS: Record<'comments' | 'tags' | 'mentions' | 'storyReplies', Who[]> = {
  comments: ['everyone', 'followers', 'following', 'off'], tags: ['everyone', 'following', 'off'], mentions: ['everyone', 'following', 'off'], storyReplies: ['everyone', 'following', 'off'],
}
const LABEL = { comments: 'ใครแสดงความคิดเห็นในโพสต์ของคุณได้', tags: 'ใครแท็กคุณในรูปได้', mentions: 'ใคร @กล่าวถึงคุณได้', storyReplies: 'ใครตอบกลับสตอรี่ได้ (ค่าเริ่มต้นของสตอรี่ใหม่)' }
type Pick = keyof typeof OPTS | null
type ListK = 'block' | 'restrict' | 'mute' | 'closeFriends' | 'storyHide' | null

const G = ({ label, children }: { label: string; children: ReactNode }) => (
  <><div className="v2-glabel" style={{ padding: '14px 16px 6px', fontSize: 13, color: 'var(--mut)', fontWeight: 600 }}>{label}</div><section className="v2-card flush" style={{ background: '#fff', borderRadius: 14, margin: '0 12px' }}>{children}</section></>
)
function Row({ icon, t, sub, end, onClick, id }: { icon: string; t: string; sub?: string; end?: ReactNode; onClick?: () => void; id?: string }) {
  return <button type="button" className="list-row" data-row={id ?? t} onClick={onClick} style={{ borderRadius: 14 }}><Icon name={icon} size={20} /><span className="grow">{t}{sub && <small>{sub}</small>}</span>{end ?? <Icon name="chev" size={16} color="var(--mut)" />}</button>
}

export function PrivacySettingsPage() {
  const db = useDb()
  const { hash } = useLocation()
  const [ps, setPs] = useState<PrivacySettings>(db.privacy ?? DEFAULT_PRIVACY)
  const [pick, setPick] = useState<Pick>(null)
  const [list, setList] = useState<ListK>(null)
  const [words, setWords] = useState(false)
  const [wtext, setWtext] = useState('')
  const [reqs, setReqs] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [cands, setCands] = useState<{ id: string }[]>([])
  const reload = () => { void loadPrivacy().then(setPs, () => {}); void loadBlocks().catch(() => {}); void loadList('closeFriends').catch(() => {}); void loadList('storyHide').catch(() => {}); void followRequests().then(setReqs, () => {}) }
  useEffect(reload, [])
  useEffect(() => { if (hash === '#story') setList('closeFriends') }, [hash])
  useEffect(() => { if (list !== 'closeFriends' && list !== 'storyHide') return; const h = setTimeout(() => { void community.mentionCandidates(q).then(setCands) }, 150); return () => clearTimeout(h) }, [q, list])
  const save = async (n: PrivacySettings, msg = 'บันทึกแล้ว') => { const old = ps; setPs(n); try { await savePrivacy(n); toast(msg) } catch (e) { setPs(old); toast((e as Error).message) } }
  const blocks = db.blocks ?? []
  const of = (k: 'block' | 'restrict' | 'mute') => blocks.filter((b) => b.kind === k).map((b) => b.id)
  const listIds = list === 'closeFriends' ? db.closeFriends ?? [] : list === 'storyHide' ? db.storyHide ?? [] : list ? of(list) : []
  const TITLE = { block: 'บัญชีที่บล็อก', restrict: 'บัญชีที่จำกัด', mute: 'บัญชีที่ปิดเสียง', closeFriends: 'เพื่อนสนิท', storyHide: 'ซ่อนสตอรี่จาก' }
  return (
    <div className="page" style={{ background: '#F4F3F8', minHeight: '100%' }}>
      <TopBar title="ความเป็นส่วนตัว" back />
      {!cloudOn() && <p style={{ margin: '10px 16px 0', fontSize: 12.5, color: 'var(--mut)' }}>บัญชีตัวอย่าง: ตั้งค่าเก็บในเครื่องนี้ · บัญชีจริงบันทึกที่เซิร์ฟเวอร์และบังคับใช้กับทุกคน</p>}
      <G label="การมองเห็นบัญชี">
        <Row icon="lock" id="private" onClick={() => ((v: boolean) => void save({ ...ps, isPrivate: v }, v ? 'เปลี่ยนเป็นบัญชีส่วนตัวแล้ว' : 'เปลี่ยนเป็นบัญชีสาธารณะแล้ว'))(!ps.isPrivate)} t="บัญชีส่วนตัว" sub={ps.isPrivate ? 'เฉพาะผู้ติดตามที่คุณอนุมัติเห็นโพสต์และสตอรี่' : 'ทุกคนเห็นโพสต์สาธารณะของคุณ'} end={<Toggle label="บัญชีส่วนตัว" on={ps.isPrivate} onChange={(v) => void save({ ...ps, isPrivate: v }, v ? 'เปลี่ยนเป็นบัญชีส่วนตัวแล้ว' : 'เปลี่ยนเป็นบัญชีสาธารณะแล้ว')} />} />
        <Row icon="bolt" id="activity" onClick={() => ((v: boolean) => void save({ ...ps, activity: v }))(!ps.activity)} t="สถานะกิจกรรม" sub="ให้คนที่คุณติดตามกันเห็นว่าคุณใช้งานอยู่ ปิดแล้วคุณจะไม่เห็นของคนอื่นด้วย" end={<Toggle label="สถานะกิจกรรม" on={ps.activity} onChange={(v) => void save({ ...ps, activity: v })} />} />
      </G>
      {reqs.length > 0 && <G label={`คำขอติดตาม · ${reqs.length}`}>
        {reqs.map((id) => { const c = creatorById(id); return (
          <div key={id} className="list-row" data-req={id}><Av src={c.avatar} size={40} /><span className="grow">{c.name}</span>
            <button type="button" className="btn btn-xs btn-p" onClick={() => void answerRequest(id, true).then(() => { setReqs(reqs.filter((x) => x !== id)); toast('อนุมัติแล้ว') }, (e: Error) => toast(e.message))}>ยืนยัน</button>
            <button type="button" className="btn btn-xs btn-o" onClick={() => void answerRequest(id, false).then(() => setReqs(reqs.filter((x) => x !== id)), (e: Error) => toast(e.message))}>ลบ</button></div>) })}
      </G>}
      <G label="การโต้ตอบ">
        {(Object.keys(OPTS) as (keyof typeof OPTS)[]).map((k) => <Row key={k} id={k} icon={k === 'comments' ? 'comment' : k === 'tags' ? 'user' : k === 'mentions' ? 'hash' : 'chat'} t={LABEL[k]} sub={who(ps[k])} onClick={() => setPick(k)} />)}
        <Row icon="eyeoff" id="hidden" t="คำที่ซ่อน" sub={ps.hiddenWords.length ? `${ps.hiddenWords.length} คำ · ความคิดเห็นที่มีคำเหล่านี้จะถูกซ่อน` : 'ซ่อนความคิดเห็นที่มีคำที่คุณไม่อยากเห็น'} onClick={() => { setWtext(ps.hiddenWords.join(', ')); setWords(true) }} />
      </G>
      <G label="สตอรี่">
        <Row icon="star" id="closeFriends" t="เพื่อนสนิท" sub={`${(db.closeFriends ?? []).length} คน · แชร์สตอรี่เฉพาะคนกลุ่มนี้ได้`} onClick={() => setList('closeFriends')} />
        <Row icon="eyeoff" id="storyHide" t="ซ่อนสตอรี่จาก" sub={`${(db.storyHide ?? []).length} คน`} onClick={() => setList('storyHide')} />
      </G>
      <G label="การเชื่อมต่อ">
        <Row icon="x" id="block" t="บัญชีที่บล็อก" sub={`${of('block').length} บัญชี`} onClick={() => setList('block')} />
        <Row icon="shield" id="restrict" t="บัญชีที่จำกัด" sub={`${of('restrict').length} บัญชี · ความคิดเห็นของเขาเห็นแค่เขากับคุณ`} onClick={() => setList('restrict')} />
        <Row icon="bell" id="mute" t="บัญชีที่ปิดเสียง" sub={`${of('mute').length} บัญชี`} onClick={() => setList('mute')} />
      </G>
      <div style={{ height: 28 }} />

      <Sheet open={!!pick} onClose={() => setPick(null)} title={pick ? LABEL[pick] : ''}>
        {pick && OPTS[pick].map((w) => <button key={w} type="button" className="list-row" role="radio" aria-checked={ps[pick] === w} data-who={w} onClick={() => { const k = pick; setPick(null); void save({ ...ps, [k]: w }) }} style={{ margin: '0 -16px', width: 'calc(100% + 32px)' }}><span className="grow">{who(w)}</span>{ps[pick] === w && <Icon name="check" size={18} color="var(--p)" />}</button>)}
      </Sheet>
      <Sheet open={words} onClose={() => setWords(false)} title="คำที่ซ่อน" sub="คั่นด้วยจุลภาค ไม่สนตัวพิมพ์เล็ก-ใหญ่ · ความคิดเห็นที่มีคำเหล่านี้จะเห็นแค่คนเขียนกับคุณ" footer={<button type="button" className="btn btn-p btn-block" onClick={() => { setWords(false); void save({ ...ps, hiddenWords: [...new Set(wtext.split(/[,\n]/).map((w) => w.trim()).filter(Boolean))].slice(0, 200) }) }}>บันทึก</button>}>
        <textarea className="ta" rows={4} value={wtext} onChange={(e) => setWtext(e.target.value)} aria-label="คำที่ซ่อน" placeholder="เช่น สแปม, ขายตรง" />
      </Sheet>
      <Sheet open={!!list} onClose={() => setList(null)} title={list ? TITLE[list] : ''} tall>
        {listIds.length === 0 && <p style={{ color: 'var(--mut)', fontSize: 13 }}>ยังไม่มี</p>}
        {listIds.map((id) => { const c = creatorById(id); return (
          <div key={id} className="list-row" data-list-item={id} style={{ margin: '0 -16px', width: 'calc(100% + 32px)' }}><Link to={`/creator/${id}`}><Av src={c.avatar} size={40} /></Link><span className="grow">{c.name}</span>
            <button type="button" className="btn btn-xs btn-o" onClick={() => void (list === 'closeFriends' || list === 'storyHide' ? toggleList(list, id, false) : setBlock(id, null)).then(() => toast('เอาออกแล้ว'), (e: Error) => toast(e.message))}>{list === 'block' ? 'เลิกบล็อก' : list === 'restrict' ? 'เลิกจำกัด' : list === 'mute' ? 'เลิกปิดเสียง' : 'เอาออก'}</button></div>) })}
        {(list === 'closeFriends' || list === 'storyHide') && <>
          <input className="inp" style={{ marginTop: 12 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเพื่อเพิ่ม…" aria-label="ค้นหาคน" />
          {cands.filter((x) => x.id !== ME && !listIds.includes(x.id)).slice(0, 15).map((x) => { const c = creatorById(x.id); return (
            <button key={x.id} type="button" className="list-row" data-add={x.id} style={{ margin: '0 -16px', width: 'calc(100% + 32px)' }} onClick={() => void toggleList(list, x.id, true).then(() => toast(`เพิ่ม ${c.name} แล้ว`), (e: Error) => toast(e.message))}><Av src={c.avatar} size={36} /><span className="grow">{c.name}</span><Icon name="plus" size={18} /></button>) })}
        </>}
      </Sheet>
    </div>
  )
}
