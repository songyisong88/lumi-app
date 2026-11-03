import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Mention } from '../data/appTypes'
import { creatorById } from '../data/sampleData'
import { community } from '../services/api'
import { Av } from '../components/ui'
import s from './Social.module.css'

type Part = { t: string; m?: Mention; tag?: boolean }
/** Split text into plain / @mention / #hashtag parts. Only names in `mentions` become links. */
export function splitMentions(text: string, mentions: Mention[] = []): Part[] {
  const names = [...mentions].sort((a, b) => b.name.length - a.name.length)
  const out: Part[] = []
  let i = 0, buf = ''
  while (i < text.length) {
    if (text[i] === '@') {
      const m = names.find((x) => text.startsWith('@' + x.name, i))
      if (m) { if (buf) out.push({ t: buf }); buf = ''; out.push({ t: '@' + m.name, m }); i += m.name.length + 1; continue }
    }
    if (text[i] === '#' && (i === 0 || /\s/.test(text[i - 1]))) {
      const h = /^#[^\s#@]+/.exec(text.slice(i))
      if (h) { if (buf) out.push({ t: buf }); buf = ''; out.push({ t: h[0], tag: true }); i += h[0].length; continue }
    }
    buf += text[i]; i++
  }
  if (buf) out.push({ t: buf })
  return out
}

/** Post / comment text with tappable @names, coloured #tags and “…ดูเพิ่มเติม”. */
export function MentionText({ text, mentions, max = 0, lead }: { text: string; mentions?: Mention[]; max?: number; lead?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const cut = max > 0 && !open && text.length > max
  const shown = cut ? text.slice(0, max).replace(/\s+\S*$/, '') : text
  return (
    <p>
      {lead}
      {splitMentions(shown, mentions).map((p, i) => p.m
        ? <Link key={i} to={`/creator/${p.m.id}`} onClick={(e) => e.stopPropagation()}>{p.t}</Link>
        : p.tag ? <em key={i}>{p.t}</em> : <Fragment key={i}>{p.t}</Fragment>)}
      {cut && <> <button type="button" className={s.more2} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}>…ดูเพิ่มเติม</button></>}
    </p>
  )
}

export interface MentionApi { focus(): void; insert(t: string): void }
/** Text box with @-autocomplete. The highlighted names are drawn by a mirror layer behind a normal textarea. */
export function MentionInput({ value, onChange, mentions, onMentions, placeholder, variant = 'big', postId, roomId, id, apiRef, onEnter, ariaLabel, up, maxLength = 3000 }: {
  value: string; onChange: (v: string) => void; mentions: Mention[]; onMentions: (m: Mention[]) => void
  placeholder?: string; variant?: 'big' | 'line'; postId?: string; roomId?: string; id?: string
  apiRef?: React.MutableRefObject<MentionApi | null>; onEnter?: () => void; ariaLabel?: string; up?: boolean; maxLength?: number
}) {
  const ta = useRef<HTMLTextAreaElement>(null)
  const mir = useRef<HTMLDivElement>(null)
  const [q, setQ] = useState<string | null>(null)
  const [list, setList] = useState<{ id: string; reason: string }[]>([])
  const [hi, setHi] = useState(0)
  const seq = useRef(0)
  const token = () => {
    const el = ta.current; if (!el) return null
    const before = el.value.slice(0, el.selectionStart ?? el.value.length)
    const m = /(^|\s)@([^\s@]{0,30})$/.exec(before)
    return m ? m[2] : null
  }
  const refresh = () => setQ(token())
  useEffect(() => {
    if (q == null) { setList([]); return }
    const n = ++seq.current
    const h = setTimeout(() => { void community.mentionCandidates(q, postId, roomId).then((r) => { if (n === seq.current) { setList(r); setHi(0) } }) }, 120)
    return () => clearTimeout(h)
  }, [q, postId, roomId])
  const grow = () => { const el = ta.current; if (el && variant === 'line') { el.style.height = 'auto'; el.style.height = `${Math.min(120, el.scrollHeight)}px` } }
  useEffect(grow, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (pid: string) => {
    const el = ta.current!; const c = creatorById(pid)
    const pos = el.selectionStart ?? value.length
    const before = value.slice(0, pos).replace(/@([^\s@]{0,30})$/, '')
    const ins = `@${c.name} `
    const next = before + ins + value.slice(pos)
    onChange(next.slice(0, maxLength))
    if (!mentions.some((m) => m.id === pid)) onMentions([...mentions, { id: pid, name: c.name }])
    setQ(null)
    requestAnimationFrame(() => { el.focus(); const p = (before + ins).length; el.setSelectionRange(p, p) })
  }
  if (apiRef) apiRef.current = {
    focus: () => ta.current?.focus(),
    insert: (t: string) => {
      const el = ta.current; const pos = el?.selectionStart ?? value.length
      const pre = value.slice(0, pos), sep = pre && !/\s$/.test(pre) ? ' ' : ''
      const next = pre + sep + t + value.slice(pos)
      onChange(next)
      requestAnimationFrame(() => { if (!el) return; el.focus(); const p = (pre + sep + t).length; el.setSelectionRange(p, p); setQ(token()) })
    },
  }
  const parts = splitMentions(value, mentions)
  const drop = q != null && list.length > 0 && (
    <div className={`${s.ment} ${up ? s.up : ''}`} role="listbox" aria-label="แท็กคน" style={!up ? { margin: variant === 'big' ? '0' : '0 0 8px' } : undefined}>
      <small>{q ? 'แท็กคน' : 'แท็กคน · พิมพ์ชื่อต่อเพื่อค้นหา'}</small>
      {list.map((x, i) => { const c = creatorById(x.id); return (
        <button key={x.id} type="button" role="option" aria-selected={i === hi} className={`${s.mrow} ${i === hi ? s.on : ''}`}
          onPointerDown={(e) => e.preventDefault()} onClick={() => choose(x.id)}>
          <Av src={c.avatar} size={variant === 'big' ? 36 : 32} /><span><b>{c.name}</b>{x.reason && <small>{x.reason}</small>}</span>
        </button>) })}
    </div>
  )
  return (
    <>
      {up && drop}
      <div className={variant === 'line' ? s.cinBox : s.cBody}>
        <div ref={mir} className={s.cMirror} aria-hidden>{parts.map((p, i) => p.m ? <em key={i}>{p.t}</em> : <Fragment key={i}>{p.t}</Fragment>)}{'\u200b'}</div>
        <textarea ref={ta} id={id} className={s.cArea} value={value} placeholder={placeholder} aria-label={ariaLabel ?? placeholder} rows={variant === 'line' ? 1 : 5} maxLength={maxLength}
          onChange={(e) => { onChange(e.target.value); requestAnimationFrame(refresh) }}
          onScroll={(e) => { if (mir.current) mir.current.scrollTop = e.currentTarget.scrollTop }}
          onClick={refresh} onKeyUp={(e) => { if (!['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) refresh() }}
          onBlur={() => setTimeout(() => setQ(null), 150)}
          onKeyDown={(e) => {
            if (q != null && list.length) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => (h + 1) % list.length); return }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => (h - 1 + list.length) % list.length); return }
              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(list[hi].id); return }
              if (e.key === 'Escape') { e.preventDefault(); setQ(null); return }
            }
            if (onEnter && e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onEnter() }
          }} />
      </div>
      {!up && drop}
    </>
  )
}
/** Keep only tags whose @name is still in the text. */
export const liveMentions = (text: string, m: Mention[]) => m.filter((x, i) => text.includes('@' + x.name) && m.findIndex((y) => y.id === x.id) === i)
