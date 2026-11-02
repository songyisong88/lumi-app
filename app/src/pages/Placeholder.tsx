import { Link, useParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { productById } from '../data/sampleData'

/** Stand-in for screens not designed yet (search is still being chosen). */
export function Placeholder({ title, note }: { title: string; note: string }) {
  const { id } = useParams()
  const p = id ? productById(id) : undefined
  return (
    <>
      <Header />
      <main className="wrap page" style={{ textAlign: 'center', padding: '72px 16px', color: 'var(--mut)' }}>
        <h1 style={{ fontSize: 20, color: 'var(--ink)', marginBottom: 6 }}>{p ? p.title : title}</h1>
        <p>{note}</p>
        <Link to="/" style={{ display: 'inline-flex', marginTop: 18, height: 36, padding: '0 14px', borderRadius: 10, background: 'var(--ink)', color: '#fff', alignItems: 'center', fontWeight: 600 }}>กลับหน้าแรก</Link>
      </main>
    </>
  )
}
