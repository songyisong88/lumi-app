import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { ISSUE_DAYS, IssueSheet, WriteReviewSheet, issueOpen } from '../../components/OrderHelp'
import { Empty, Img, SampleNote, Sheet, Stars, Tabs, TopBar, copyText } from '../../components/ui'
import type { Asset, Purchase } from '../../data/appTypes'
import { HIRE_STEPS } from '../../data/appTypes'
import { LIB_TABS, assetsOf, inTab, type LibTab } from '../../data/library'
import { downloadAsset } from '../../services/download'
import { licRows, sellTypeOf } from '../../data/listingSpec'
import { pageContent } from '../../data/productExtras'
import { baht, creatorById, productById } from '../../data/sampleData'
import { chat } from '../../services/api'
import { useDb } from '../../services/db'
import { toast } from '../../services/toast'
import { ago } from '../../utils/time'
import s from './Library.module.css'
import { REAL } from '../../config'

const KIND: Record<Asset['kind'], { icon: string; color: string; bg: string; label: string }> = {
  file: { icon: 'file', color: '#1D5FD6', bg: '#EAF2FF', label: 'ไฟล์' },
  key: { icon: 'key', color: '#6C2BD9', bg: '#F3ECFF', label: 'คีย์' },
  prompt: { icon: 'sparkle', color: '#B45309', bg: '#FFF4E5', label: 'พรอมต์' },
  link: { icon: 'link', color: '#0F766E', bg: '#E2F6F2', label: 'ลิงก์' },
}
const isHire = (b: Purchase) => b.optionLabel === 'งานจ้าง'

/** คลังของที่ซื้อ: every purchase with its files, keys, links and receipt, in one place (not buried in chat). */
const download = downloadAsset

export function Library() {
  const db = useDb()
  const [tab, setTab] = useState<LibTab>('all')
  const list = db.purchases.filter((b) => inTab(b, tab))
  const working = db.threads.filter((t) => t.role === 'creator' && t.hire && !!t.amount && (t.step ?? 0) >= 3 && (t.step ?? 0) < 5)
  const showWorking = (tab === 'all' || tab === 'hire') && working.length > 0
  return (
    <div className={s.page}>
      <TopBar title="คลังของที่ซื้อ" sub={`${db.purchases.length} รายการ · ไฟล์ คีย์ ลิงก์ และใบเสร็จ`} />
      <Tabs value={tab} onChange={setTab} options={LIB_TABS.map((x) => ({ v: x.v, label: x.label }))} sticky />
      {showWorking && (
        <div className="sec" data-lib-working>
          <div className="sec-h">งานจ้างที่กำลังทำ<span className="more">{working.length} งาน</span></div>
          <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>
            {working.map((t) => (
              <Link key={t.id} to={`/chat/${t.id}`} className="list-row">
                <Img src={t.image} className={s.th} />
                <span className="grow"><b className="ell" style={{ display: 'block' }}>{t.title}</b><small className="ell">{creatorById(t.partnerId).name} · ขั้น {(t.step ?? 0) + 1}/{HIRE_STEPS.length} · {t.status}</small><small>ไฟล์งานจะเข้าคลังนี้เมื่อคุณกดรับงาน</small></span>
                <Icon name="chev" size={16} color="var(--mut)" />
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="sec">
        {list.length === 0 ? (
          showWorking ? null : <Empty icon="box" title={tab === 'all' ? 'ยังไม่มีของที่ซื้อ' : `ยังไม่มีรายการใน “${LIB_TABS.find((x) => x.v === tab)!.label}”`} text="ของที่ซื้อและของฟรีที่กดรับ จะเก็บไว้ที่นี่ เปิดโหลดซ้ำได้จากคลังของที่ซื้อ · แนะนำให้ดาวน์โหลดเก็บไว้" action={<Link to="/" className="btn btn-p btn-sm">เลือกดูผลงาน</Link>} />
        ) : (
          <div className="card2" style={{ padding: 0, overflow: 'hidden' }} data-lib-list>
            {list.map((b, i) => {
              const a = assetsOf(b)
              const kinds = (['file', 'key', 'prompt', 'link'] as const).filter((k) => a.some((x) => x.kind === k))
              return (
                <Link key={b.id} to={`/library/${b.id}`} className="list-row rise" style={{ '--i': Math.min(i, 6) } as React.CSSProperties} data-lib-item={b.id}>
                  <Img src={b.image} className={s.th} />
                  <span className="grow">
                    <b className="ell" style={{ display: 'block' }}>{b.title}</b>
                    <small className="ell">{creatorById(b.creatorId).name} · {b.optionLabel && b.optionLabel !== 'ของฟรี' ? `${b.optionLabel} · ` : ''}{b.price ? baht(b.price) : 'ฟรี'} · {ago(b.at)}</small>
                    <span className={s.chips}>
                      {kinds.map((k) => <span key={k} className="pill"><Icon name={KIND[k].icon} size={11} color={KIND[k].color} />{KIND[k].label}{k === 'file' ? ` ${a.filter((x) => x.kind === 'file').length}` : ''}</span>)}
                      {b.issue && <span className="pill pill-r">แจ้งปัญหาแล้ว</span>}
                    </span>
                  </span>
                  <Icon name="chev" size={16} color="var(--mut)" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
      <div style={{ padding: '6px 16px 0' }}><SampleNote>ไฟล์ตัวอย่าง · ระบบเก็บไฟล์จริงจะเปิดพร้อมการซื้อขายจริง</SampleNote></div>
    </div>
  )
}

export function LibraryItem() {
  const { id = '' } = useParams()
  const db = useDb()
  const nav = useNavigate()
  const [sheet, setSheet] = useState<null | 'receipt' | 'review' | 'issue'>(null)
  const b = db.purchases.find((x) => x.id === id)
  if (!b) return <div className={s.page}><TopBar title="คลังของที่ซื้อ" /><Empty icon="box" title="ไม่พบรายการนี้" text="รายการอาจถูกลบเมื่อรีเซ็ตข้อมูลตัวอย่าง" action={<Link to="/library" className="btn btn-p btn-sm">ดูคลังทั้งหมด</Link>} /></div>
  const a = assetsOf(b)
  const p = productById(b.productId)
  const c = creatorById(b.creatorId)
  const order = db.orders.find((o) => o.no === b.orderNo)
  const lic = p && !isHire(b) ? pageContent(p).lic : undefined
  const files = a.filter((x) => x.kind === 'file'), codes = a.filter((x) => x.kind === 'key' || x.kind === 'prompt'), links = a.filter((x) => x.kind === 'link')
  const openChat = async () => nav(`/chat/${b.threadId ?? await chat.openWith(b.creatorId, b.productId)}`)
  const copy = (x: Asset) => { copyText(x.value); toast(`คัดลอก${KIND[x.kind].label}แล้ว`) }
  return (
    <div className={s.page}>
      <TopBar title="ของที่ซื้อ" sub={`ออเดอร์ #${b.orderNo}${b.price ? "" : " · รับฟรี"}`} right={<button className="tb-btn" aria-label="ใบเสร็จ" onClick={() => setSheet('receipt')}><Icon name="receipt" size={20} /></button>} />
      <div className={s.head}>
        <Img src={b.image} className={s.big} />
        <div style={{ minWidth: 0 }}>
          <b>{b.title}</b>
          <small>{c.name} · {b.optionLabel ?? 'มาตรฐาน'} · {b.price ? baht(b.price) : 'ฟรี'}</small>
          <small>ได้รับ{ago(b.at).startsWith('เมื่อ') ? '' : ' '}{ago(b.at)}{b.review && <> · <Stars v={b.review.stars} size={11} /></>}</small>
        </div>
      </div>
      {b.issue && <div className="hint" style={{ background: '#FEF2F2', color: '#B91C1C', borderRadius: 12, padding: '10px 12px', margin: '12px 16px 0' }}><b>แจ้งปัญหาแล้ว: {b.issue.reason}</b><br />{b.issue.status}</div>}

      {files.length > 0 && <div className="sec" data-lib-files>
        <div className="sec-h">ไฟล์<span className="more">{files.length} ไฟล์</span></div>
        <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>
          {files.map((x) => (
            <div key={x.title} className="list-row">
              <span className={s.ai} style={{ background: KIND.file.bg }}><Icon name="file" size={18} color={KIND.file.color} /></span>
              <span className="grow"><b className="ell" style={{ display: 'block' }}>{x.title}</b><small>{x.size || 'ไฟล์'}</small></span>
              <button className="btn btn-xs btn-s" data-dl onClick={() => { void download(x, b) }}><Icon name="download" size={14} />ดาวน์โหลด</button>
            </div>
          ))}
        </div>
      </div>}

      {codes.length > 0 && <div className="sec" data-lib-codes>
        <div className="sec-h">{[...new Set(codes.map((x) => x.kind === 'key' ? 'คีย์' : x.kind === 'prompt' ? 'พรอมต์' : 'ลิงก์'))].join('และ')}</div>
        <div className="card2">
          {codes.map((x, i) => (
            <div key={x.title} style={{ marginTop: i ? 14 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name={KIND[x.kind].icon} size={16} color={KIND[x.kind].color} /><b className="grow" style={{ fontSize: 14 }}>{x.title}</b><button className="btn btn-xs btn-s" data-copy={x.kind} onClick={() => copy(x)}><Icon name="copy" size={14} />คัดลอก</button></div>
              <code className={s.code}>{x.value}</code>
            </div>
          ))}
          {codes.some((x) => x.kind === 'key') && <p className="hint">ใช้คีย์นี้เปิดใช้งานตามวิธีในหน้าผลงาน · ย้ายเครื่องหรือคีย์ใช้ไม่ได้ ทักครีเอเตอร์ได้เลย</p>}
        </div>
      </div>}

      {links.length > 0 && <div className="sec" data-lib-links>
        <div className="sec-h">ลิงก์</div>
        <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>
          {links.map((x) => (
            <div key={x.title} className="list-row">
              <span className={s.ai} style={{ background: KIND.link.bg }}><Icon name="link" size={18} color={KIND.link.color} /></span>
              <span className="grow"><b className="ell" style={{ display: 'block' }}>{x.title}</b><small className="ell">{x.value.startsWith('#/') ? 'เปิดใน LUMI' : x.value}</small></span>
              {x.value.startsWith('#/') ? <button className="btn btn-xs btn-s" onClick={() => nav(x.value.slice(1))}>เปิด</button> : <button className="btn btn-xs btn-s" onClick={() => copy(x)}><Icon name="copy" size={14} />คัดลอก</button>}
            </div>
          ))}
        </div>
      </div>}

      {lic && <div className="sec" data-lib-license>
        <div className="sec-h">สิทธิ์การใช้งาน<span className="more" style={{ color: 'var(--mut)' }}>{b.optionLabel ?? 'มาตรฐาน'}</span></div>
        <div className="card2"><table className={s.lic}><tbody>{licRows(p ? sellTypeOf(p) : null).map((r) => <tr key={r}><td>{r}</td><td className={lic.includes(r) ? s.yes : s.no}>{lic.includes(r) ? '✓ ได้' : '–'}</td></tr>)}</tbody></table></div>
      </div>}

      <div className="sec">
        <div className="card2" style={{ padding: 0, overflow: 'hidden' }}>
          <button className="list-row" onClick={() => setSheet('receipt')} data-lib-receipt><Icon name="receipt" size={20} color="var(--p)" /><span className="grow">ใบเสร็จ<small>ออเดอร์ #{b.orderNo}</small></span><Icon name="chev" size={16} color="var(--mut)" /></button>
          <button className="list-row" onClick={() => setSheet('review')}><Icon name="star" size={20} color="#F5A524" /><span className="grow">{b.review ? 'แก้ไขรีวิว' : 'เขียนรีวิว'}{b.review && <small className="ell">{b.review.text || 'ไม่มีข้อความ'}</small>}</span><Icon name="chev" size={16} color="var(--mut)" /></button>
          <button className="list-row" onClick={openChat}><Icon name="chat" size={20} color="var(--ink2)" /><span className="grow">ทักครีเอเตอร์<small>{c.name} · ถามวิธีใช้ หรือขอไฟล์เพิ่ม</small></span><Icon name="chev" size={16} color="var(--mut)" /></button>
          {p && !isHire(b) && <Link to={`/product/${p.id}`} className="list-row"><Icon name="store" size={20} color="var(--ink2)" /><span className="grow">ดูหน้าผลงาน<small>วิธีใช้ รายละเอียด และรีวิว</small></span><Icon name="chev" size={16} color="var(--mut)" /></Link>}
          {isHire(b)
            ? b.threadId && <Link to={`/chat/${b.threadId}`} className="list-row"><Icon name="flag" size={20} color="#DC2626" /><span className="grow">แจ้งปัญหางานจ้าง<small>แจ้งในแชตงานจ้าง เมนู ⋯</small></span><Icon name="chev" size={16} color="var(--mut)" /></Link>
            : !b.issue && <button className="list-row" style={{ color: issueOpen(b.at) ? '#DC2626' : undefined }} disabled={!issueOpen(b.at)} onClick={() => setSheet('issue')}><Icon name="flag" size={20} color={issueOpen(b.at) ? '#DC2626' : 'var(--mut)'} /><span className="grow">{b.price ? 'แจ้งปัญหา / ขอคืนเงิน' : 'แจ้งปัญหา'}<small>{issueOpen(b.at) ? `แจ้งได้ภายใน ${ISSUE_DAYS} วันหลังซื้อ` : `เกิน ${ISSUE_DAYS} วันแล้ว · ทักครีเอเตอร์ได้`}</small></span></button>}
        </div>
      </div>
      <div style={{ padding: '6px 16px 0' }}><SampleNote>ไฟล์ตัวอย่าง · ระบบเก็บไฟล์และสแกนไวรัสจริงจะเปิดพร้อมการซื้อขายจริง</SampleNote></div>

      <Sheet open={sheet === 'receipt'} onClose={() => setSheet(null)} title="ใบเสร็จ" sub={`ออเดอร์ #${b.orderNo}`}>
        <table className={s.rc} data-receipt><tbody>
          <tr><td>วันที่</td><td>{new Date(order?.at ?? b.at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</td></tr>
          <tr><td>ผลงาน</td><td>{b.title}</td></tr>
          <tr><td>ครีเอเตอร์</td><td>{c.name}</td></tr>
          {b.optionLabel && <tr><td>ตัวเลือก</td><td>{b.optionLabel}</td></tr>}
          <tr><td>ราคา</td><td>{b.price ? baht(b.price) : 'ฟรี'}</td></tr>
          {order && order.items.length > 1 && <tr><td>ในออเดอร์เดียวกัน</td><td>{order.items.length} รายการ · รวม {baht(order.total)}</td></tr>}
          {order && order.discount > 0 && <tr><td>ส่วนลดของออเดอร์</td><td>−{baht(order.discount)}</td></tr>}
          <tr><td>ชำระด้วย</td><td>{b.price ? order?.method ?? 'ชำระแล้ว (ทดลอง)' : 'ของฟรี'}</td></tr>
          <tr className={s.tot}><td>ยอดที่จ่าย</td><td>{b.price ? baht(b.price) : '฿0'}</td></tr>
        </tbody></table>
        <p className="hint">{REAL ? 'ใบเสร็จนี้ไม่ใช่ใบกำกับภาษี' : 'ใบเสร็จตัวอย่าง ไม่ใช่ใบกำกับภาษี · ใบเสร็จทางอีเมลจะเปิดพร้อมระบบบัญชีจริง'}</p>
        <button className="btn btn-s btn-block" style={{ marginTop: 10 }} onClick={() => { copyText(`LUMI ออเดอร์ #${b.orderNo} · ${b.title} · ${b.price ? baht(b.price) : 'ฟรี'}`); toast('คัดลอกข้อมูลใบเสร็จแล้ว') }}><Icon name="copy" size={16} />คัดลอกข้อมูลใบเสร็จ</button>
      </Sheet>
      <IssueSheet open={sheet === 'issue'} onClose={() => setSheet(null)} purchaseId={b.id} />
      <WriteReviewSheet open={sheet === 'review'} onClose={() => setSheet(null)} purchaseId={b.id} initial={b.review} />
    </div>
  )
}
