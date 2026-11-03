// Instagram/Facebook-style ⋯ menu for a post, who-liked list and the owner's edit sheet (behaviour only, our own look).
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Av, Sheet } from '../components/ui'
import type { Audience, Post } from '../data/appTypes'
import { ME, creatorById } from '../data/sampleData'
import { community, follows } from '../services/api'
import { useDb } from '../services/db'
import { AUDIENCE, blockOf, likers, setBlock, setPostOptions, type Liker } from '../services/social'
import { toast } from '../services/toast'
import { settle } from '../services/backClose'
import { REACTIONS } from './reactions'
import s from './Social.module.css'
import { ago } from '../utils/time'

const err = (e: unknown) => toast((e as Error).message || 'ทำรายการไม่สำเร็จ')
function R({ icon, t, sub, onClick, red, end }: { icon: string; t: string; sub?: string; onClick: () => void; red?: boolean; end?: React.ReactNode }) {
  return <button type="button" className={`list-row ${red ? s.red : ''}`} data-opt={t} onClick={onClick}><Icon name={icon} size={20} color={red ? '#DC2626' : 'currentColor'} /><span className="grow">{t}{sub && <small>{sub}</small>}</span>{end}</button>
}

export function PostMenu({ p, open, onClose, full, onEdit, onReport, onShare }: { p: Post; open: boolean; onClose: () => void; full?: boolean; onEdit: () => void; onReport: () => void; onShare: () => void }) {
  const db = useDb()
  const nav = useNavigate()
  const a = creatorById(p.authorId)
  const isMine = p.authorId === ME || !!p.mine
  const saved = db.saved.includes(p.id)
  const following = db.follows.includes(p.authorId)
  const bk = blockOf(p.authorId)
  const [aud, setAud] = useState(false)
  const [blk, setBlk] = useState(false)
  const run = (f: () => Promise<unknown> | void, msg?: string) => async () => { onClose(); try { await f(); if (msg) toast(msg) } catch (e) { err(e) } }
  const later = (f: () => void) => () => { onClose(); setTimeout(f, 220) }
  const nativeShare = async () => {
    const url = `${location.origin}${location.pathname}#/community/post/${p.id}`
    onClose()
    if (navigator.share) { try { await navigator.share({ url, title: a.name }); void community.share(p.id) } catch { /* cancelled */ } } else onShare()
  }
  return (
    <>
      <Sheet open={open} onClose={onClose} title="ตัวเลือกโพสต์">
        <div className={s.qa}>
          <button type="button" aria-pressed={saved} onClick={() => { Promise.resolve(community.save(p.id)).catch(err); onClose(); toast(saved ? 'เอาออกจากที่บันทึกแล้ว' : 'บันทึกโพสต์แล้ว') }}><Icon name="bookmark" size={22} fill={saved ? 'currentColor' : 'none'} />{saved ? 'บันทึกแล้ว' : 'บันทึก'}</button>
          <button type="button" onClick={() => { onClose(); onShare() }}><Icon name="link" size={22} />คัดลอกลิงก์</button>
          <button type="button" onClick={() => void nativeShare()}><Icon name="share" size={22} />แชร์</button>
        </div>
        {isMine ? <>
          <div className={s.mgrp}>
            <R icon="pin" t={p.pinnedAt ? 'เลิกปักหมุด' : 'ปักหมุดไว้บนโปรไฟล์'} sub="ปักได้สูงสุด 3 โพสต์" onClick={run(() => setPostOptions(p.id, { pinned: !p.pinnedAt }), p.pinnedAt ? 'เลิกปักหมุดแล้ว' : 'ปักหมุดแล้ว')} />
            <R icon="box" t={p.archivedAt ? 'แสดงบนโปรไฟล์อีกครั้ง' : 'เก็บถาวร'} sub={p.archivedAt ? undefined : 'ซ่อนจากทุกคน คุณยังเห็นได้คนเดียว'} onClick={run(() => setPostOptions(p.id, { archived: !p.archivedAt }), p.archivedAt ? 'แสดงโพสต์อีกครั้งแล้ว' : 'เก็บถาวรแล้ว · มีแค่คุณที่เห็น')} />
            <R icon={p.hideLikes ? 'eye' : 'eyeoff'} t={p.hideLikes ? 'แสดงจำนวนถูกใจ' : 'ซ่อนจำนวนถูกใจ'} sub={p.hideLikes ? undefined : 'คนอื่นจะไม่เห็นจำนวนและรายชื่อคนที่ถูกใจ'} onClick={run(() => setPostOptions(p.id, { hideLikes: !p.hideLikes }), p.hideLikes ? 'แสดงจำนวนถูกใจแล้ว' : 'ซ่อนจำนวนถูกใจแล้ว')} />
            <R icon="comment" t={p.commentsOff ? 'เปิดการแสดงความคิดเห็น' : 'ปิดการแสดงความคิดเห็น'} onClick={run(() => setPostOptions(p.id, { commentsOff: !p.commentsOff }), p.commentsOff ? 'เปิดความคิดเห็นแล้ว' : 'ปิดความคิดเห็นแล้ว')} />
            <R icon={AUDIENCE[p.audience ?? 'public'].icon} t="ใครดูโพสต์นี้ได้" sub={AUDIENCE[p.audience ?? 'public'].l} onClick={later(() => setAud(true))} />
          </div>
          <div className={s.mgrp}>
            <R icon="edit" t="แก้ไข" sub="ข้อความ สถานที่ และคำอธิบายรูป" onClick={later(onEdit)} />
            <R icon="trash" red t="ลบ" sub="ลบแล้วกู้คืนไม่ได้" onClick={async () => { if (!confirm('ลบโพสต์นี้? ความคิดเห็นทั้งหมดจะหายไปด้วย')) return; onClose(); await settle(); try { await community.deletePost(p.id); toast('ลบโพสต์แล้ว'); if (full) nav('/community', { replace: true }) } catch (e) { err(e) } }} />
          </div>
        </> : <>
          <div className={s.mgrp}>
            {following && <R icon="user" t={`เลิกติดตาม ${a.name}`} onClick={run(() => follows.toggle(p.authorId), `เลิกติดตาม ${a.name} แล้ว`)} />}
            {!full && <R icon="eyeoff" t="ซ่อนโพสต์นี้" sub="จะเห็นโพสต์แบบนี้น้อยลง" onClick={run(() => community.hide(p.id), 'ซ่อนโพสต์แล้ว')} />}
            <R icon="bell" t={bk === 'mute' ? `เลิกปิดเสียง ${a.name}` : `ปิดเสียง ${a.name}`} sub={bk === 'mute' ? undefined : 'ไม่เห็นโพสต์และสตอรี่ เขาไม่รู้ว่าถูกปิดเสียง'} onClick={run(() => setBlock(p.authorId, bk === 'mute' ? null : 'mute'), bk === 'mute' ? 'เลิกปิดเสียงแล้ว' : `ปิดเสียง ${a.name} แล้ว`)} />
            <R icon="shield" t={bk === 'restrict' ? `เลิกจำกัด ${a.name}` : `จำกัด ${a.name}`} sub={bk === 'restrict' ? undefined : 'ความคิดเห็นใหม่ของเขาจะเห็นแค่เขากับคุณ'} onClick={run(() => setBlock(p.authorId, bk === 'restrict' ? null : 'restrict'), bk === 'restrict' ? 'เลิกจำกัดแล้ว' : `จำกัด ${a.name} แล้ว`)} />
          </div>
          <div className={s.mgrp}>
            <R icon="x" red t={`บล็อก ${a.name}`} onClick={later(() => setBlk(true))} />
            <R icon="flag" red t="รายงาน" onClick={later(onReport)} />
          </div>
        </>}
      </Sheet>
      <Sheet open={aud} onClose={() => setAud(false)} title="ใครดูโพสต์นี้ได้">
        <AudiencePick value={p.audience ?? 'public'} onChange={async (v) => { setAud(false); try { await setPostOptions(p.id, { audience: v }); toast(`ตั้งเป็น “${AUDIENCE[v].l}” แล้ว`) } catch (e) { err(e) } }} />
      </Sheet>
      <Sheet open={blk} onClose={() => setBlk(false)} title={`บล็อก ${a.name}?`} sub="เขาจะไม่เห็นโพสต์ สตอรี่ และโปรไฟล์ของคุณ แท็ก คอมเมนต์ ถูกใจ หรือทักแชตคุณไม่ได้ เขาจะไม่ได้รับแจ้ง"
        footer={<button type="button" className="btn btn-block" style={{ background: '#DC2626', color: '#fff' }} onClick={async () => { setBlk(false); await settle(); try { await setBlock(p.authorId, 'block'); toast(`บล็อก ${a.name} แล้ว`); if (full) nav(-1) } catch (e) { err(e) } }}>บล็อก</button>}>
        <p style={{ color: 'var(--mut)', fontSize: 13 }}>เลิกบล็อกได้ที่ เมนู › ความเป็นส่วนตัว › บัญชีที่บล็อก</p>
      </Sheet>
    </>
  )
}

export function AudiencePick({ value, onChange, only }: { value: Audience; onChange: (v: Audience) => void; only?: Audience[] }) {
  return (
    <div className={s.seg} role="radiogroup">
      {(only ?? (Object.keys(AUDIENCE) as Audience[])).map((k) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)}>
          <Icon name={AUDIENCE[k].icon} size={20} /><span className="grow"><b>{AUDIENCE[k].l}</b><small>{AUDIENCE[k].sub}</small></span>{value === k && <Icon name="check" size={18} color="var(--p)" />}
        </button>
      ))}
    </div>
  )
}

/** Who liked: real people from the server (hidden-like and blocked rules apply there). Sample posts show the emoji totals. */
export function LikersSheet({ p, open, onClose, mine }: { p: Post; open: boolean; onClose: () => void; mine?: string }) {
  const [list, setList] = useState<Liker[] | null | undefined>(undefined)
  useEffect(() => { if (!open) return; setList(undefined); likers(p.id).then(setList, () => setList(null)) }, [open, p.id])
  const em = (k: string) => REACTIONS.find((r) => r.k === k)?.e ?? '❤️'
  return (
    <Sheet open={open} onClose={onClose} title="ถูกใจ" sub={p.hideLikes && !(p.authorId === ME || p.mine) ? 'เจ้าของโพสต์ซ่อนจำนวนถูกใจ' : `ทั้งหมด ${p.likes.toLocaleString('th-TH')}`} tall>
      {list === undefined ? <p style={{ color: 'var(--mut)' }}>กำลังโหลด…</p>
        : list === null ? (
          <div style={{ margin: '0 -16px' }}>
            {REACTIONS.filter((r) => (p.rx?.[r.k] ?? 0) > 0 || mine === r.k).map((r) => (
              <div key={r.k} className="list-row"><span style={{ fontSize: 24 }}>{r.e}</span><span className="grow">{r.l}{mine === r.k && <small>รวมของคุณ</small>}</span><b>{(p.rx?.[r.k] ?? 0).toLocaleString('th-TH')}</b></div>
            ))}
          </div>
        ) : list.length === 0 ? <p style={{ color: 'var(--mut)' }}>{p.hideLikes ? 'เจ้าของโพสต์ไม่แสดงรายชื่อคนที่ถูกใจ' : 'ยังไม่มีคนถูกใจ'}</p>
        : list.map((l) => { const c = creatorById(l.id); return (
          <Link key={l.id} to={`/creator/${l.id}`} className={s.likr} data-liker={l.id} onClick={onClose}>
            <Av src={c.avatar} size={44} /><span className="grow"><b>{c.name}</b><small>{ago(l.at)}</small></span><span style={{ fontSize: 20 }}>{em(l.kind)}</span>
          </Link>) })}
    </Sheet>
  )
}

export function EditPostSheet({ p, open, onClose }: { p: Post; open: boolean; onClose: () => void }) {
  const [text, setText] = useState(p.text)
  const [loc, setLoc] = useState(p.location ?? '')
  const [alt, setAlt] = useState<string[]>(p.alt ?? [])
  useEffect(() => { if (open) { setText(p.text); setLoc(p.location ?? ''); setAlt(p.alt ?? []) } }, [open, p])
  const save = async () => {
    try {
      if (text.trim() !== p.text) await community.editPost(p.id, { text: text.trim() })
      await setPostOptions(p.id, { location: loc.trim(), alt: p.images.map((_, i) => (alt[i] ?? '').trim()) })
      onClose(); toast('บันทึกแล้ว')
    } catch (e) { err(e) }
  }
  return (
    <Sheet open={open} onClose={onClose} title="แก้ไขโพสต์" tall footer={<button type="button" className="btn btn-p btn-block" disabled={!text.trim()} onClick={() => void save()}>บันทึก</button>}>
      <textarea className="ta" rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="ข้อความโพสต์" maxLength={2000} />
      <label style={{ display: 'block', marginTop: 12, marginBottom: 6, fontSize: 13, fontWeight: 600 }}>สถานที่ (ไม่บังคับ)</label>
      <input className="inp" value={loc} onChange={(e) => setLoc(e.target.value)} maxLength={80} placeholder="เช่น กรุงเทพฯ" aria-label="สถานที่" />
      {p.images.length > 0 && <>
        <label style={{ display: 'block', marginTop: 12, marginBottom: 6, fontSize: 13, fontWeight: 600 }}>คำอธิบายรูป (alt text) สำหรับผู้ใช้โปรแกรมอ่านหน้าจอ</label>
        {p.images.map((src, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <img src={src} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
            <input className="inp" style={{ flex: 1 }} value={alt[i] ?? ''} onChange={(e) => setAlt((a) => { const n = [...a]; n[i] = e.target.value; return n })} maxLength={300} placeholder={`รูปที่ ${i + 1}`} aria-label={`คำอธิบายรูปที่ ${i + 1}`} />
          </div>
        ))}
      </>}
    </Sheet>
  )
}
