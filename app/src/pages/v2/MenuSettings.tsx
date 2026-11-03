import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { Av, Empty, Sheet, TopBar } from '../../components/ui'
import { creatorById, ME } from '../../data/sampleData'
import { resetAll } from '../../services/api'
import { useDb } from '../../services/db'
import { pending, useModeration } from '../../services/moderation'
import { isCloud, leaveDemo, signOut, useSession } from '../../services/session'
import { useIsAdmin } from '../../services/staff'
import { toast } from '../../services/toast'
import { ago } from '../../utils/time'
import { BRAND, brandName } from '../../config'

function Row({ icon, t, sub, to, onClick, end, tone }: { icon: string; t: string; sub?: string; to?: string; onClick?: () => void; end?: ReactNode; tone?: 'off' | 'red' }) {
  const body = <><span className="ic-w"><Icon name={icon} size={20} color="currentColor" /></span><span className="tx">{t}{sub && <small>{sub}</small>}</span><span className="end">{end}{tone !== 'off' && tone !== 'red' && <Icon name="chev" size={16} color="var(--mut)" />}</span></>
  if (to) return <Link to={to} className={`v2-li ${tone ?? ''}`} data-menu={t}>{body}</Link>
  return <button className={`v2-li ${tone ?? ''}`} onClick={onClick} disabled={tone === 'off'} data-menu={t}>{body}</button>
}
const G = ({ label, tag, children }: { label: string; tag?: string; children: ReactNode }) => (
  <><div className="v2-glabel" style={tag ? { display: 'flex', gap: 8, alignItems: 'center' } : undefined}>{label}{tag && <span className="v2-pill">{tag}</span>}</div><section className="v2-card flush">{children}</section></>
)

/** UI v2 (demo): ☰ เมนูและตั้งค่า (mockup 03). The admin group shows only for accounts with an admin_roles row. */
export function MenuSettings() {
  const ses = useSession()
  const nav = useNavigate()
  const admin = useIsAdmin()
  useModeration()
  const [help, setHelp] = useState(false)
  const me = creatorById(ME)
  const guest = ses.mode === 'guest'
  const acc = isCloud() ? '/account' : '/account/login'
  const q = admin ? pending() : []
  const ai = q.filter((x) => x.tab === 'ai').length, rep = q.length - ai
  const creator = ses.mode === 'demo' || !!ses.profile?.is_creator
  return (
    <div className="v2 page">
      <TopBar title="เมนูและตั้งค่า" />
      <div style={{ height: 12 }} />
      <section className="v2-card flush">
        {guest
          ? <Row icon="user" t="เข้าสู่ระบบ" sub="ซื้อ เก็บของที่ชอบ และเปิดร้าน" to="/account/login" />
          : <Link to="/profile" className="v2-li"><Av src={me.avatar} size={44} /><span className="tx"><b style={{ fontWeight: 600 }}>{brandName(ses.profile?.display_name || me.name)}</b><small>{ses.mode === 'demo' ? 'บัญชีตัวอย่าง' : ses.email}</small></span><span className="end" style={{ color: 'var(--p)', fontWeight: 600 }}>ดูโปรไฟล์ ›</span></Link>}
      </section>

      {admin && <G label="สำหรับแอดมิน" tag="คนอื่นไม่เห็นส่วนนี้">
        <Row icon="shield" t="ตรวจผลงาน" sub={`AI ไม่แน่ใจ ${ai} · ถูกรายงาน ${rep}`} to="/admin" end={q.length > 0 && <span className="v2-badge">{q.length}</span>} />
      </G>}

      <G label="บัญชี">
        <Row icon="user" t="บัญชีและการเข้าสู่ระบบ" sub={isCloud() ? 'ชื่อ อีเมล รหัสผ่าน' : 'สมัคร หรือเข้าสู่ระบบด้วยอีเมล'} to={acc} />
        <Row icon="lock" t="ความเป็นส่วนตัว" sub="บัญชีส่วนตัว ใครคอมเมนต์/แท็กได้ คำที่ซ่อน บล็อก เพื่อนสนิท" to="/settings/privacy" />
        <Row icon="shield" t="ความปลอดภัย" sub="รหัสผ่าน และขอลบบัญชี" to={acc} />
        <Row icon="bell" t="การแจ้งเตือน" to="/notifications" />
      </G>

      {creator && !guest && <G label="ร้านของฉัน">
        <Row icon="store" t="ข้อมูลร้าน" sub="ชื่อร้าน รูป และคำแนะนำร้าน" to={isCloud() ? '/account' : `/creator/${ME}`} />
        <Row icon="wallet" t="บัญชีรับเงิน" sub="ยังไม่เปิด · รอเชื่อมระบบรับเงิน" tone="off" end={<span className="v2-pill">เร็ว ๆ นี้</span>} />
      </G>}

      <G label="ชุมชน">
        <Row icon="bookmark" t="โพสต์ที่บันทึก" to="/saved" />
        <Row icon="camera" t="สตอรี่ของฉัน" sub="ลงสตอรี่ใหม่ อยู่ 24 ชั่วโมง" to="/story/new" />
      </G>

      <G label="อื่น ๆ">
        <Row icon="chat" t={`ช่วยเหลือและติดต่อ ${BRAND}`} onClick={() => setHelp(true)} />
        {ses.mode === 'demo' && <Row icon="refresh" t="รีเซ็ตข้อมูลตัวอย่าง" sub="ตะกร้า แชต ร่าง กลับเป็นค่าเริ่มต้น" onClick={() => { resetAll(); toast('รีเซ็ตข้อมูลตัวอย่างแล้ว') }} />}
        {!guest && <Row icon="arrow" t={ses.mode === 'demo' ? 'ออกจากบัญชีตัวอย่าง' : 'ออกจากระบบ'} tone="red" onClick={async () => { if (ses.mode === 'demo') await leaveDemo(); else await signOut(); nav('/', { replace: true }) }} />}
      </G>
      <div style={{ height: 24 }} />

      <Sheet open={help} onClose={() => setHelp(false)} title={`ช่วยเหลือและติดต่อ ${BRAND}`}>
        <Row icon="flag" t="มีปัญหากับของที่ซื้อ" sub="คลังของที่ซื้อ › ⋯ › แจ้งปัญหา (ภายใน 7 วัน)" to="/library" />
        <Row icon="chat" t="คุยกับครีเอเตอร์" sub="ถามเรื่องไฟล์หรือวิธีใช้ในแชต" to="/chat" />
        <p className="v2-sm" style={{ padding: '8px 0' }}>ช่องทางติดต่อทีม {BRAND} โดยตรงจะเปิดพร้อมระบบช่วยเหลือ</p>
      </Sheet>
    </div>
  )
}

/** UI v2 (demo): saved community posts (from the profile and the menu). */
export function SavedPosts() {
  const db = useDb()
  const posts = db.posts.filter((x) => db.saved.includes(x.id))
  return (
    <div className="v2 page">
      <TopBar title="โพสต์ที่บันทึก" sub={`${posts.length} โพสต์`} />
      <div style={{ height: 12 }} />
      {posts.length === 0 ? <Empty icon="bookmark" title="ยังไม่มีโพสต์ที่บันทึก" text="กด ⋯ บนโพสต์ในชุมชน แล้วเลือก “บันทึกโพสต์”" action={<Link to="/community" className="btn btn-s btn-sm">ไปที่ชุมชน</Link>} /> : (
        <section className="v2-card flush">{posts.map((p) => (
          <Link key={p.id} to={`/community/post/${p.id}`} className="v2-li"><Av src={creatorById(p.authorId).avatar} size={40} /><span className="tx"><span className="ell" style={{ display: 'block' }}>{p.text}</span><small>{creatorById(p.authorId).name} · {ago(p.at)}</small></span><Icon name="chev" size={16} color="var(--mut)" /></Link>
        ))}</section>
      )}
    </div>
  )
}
