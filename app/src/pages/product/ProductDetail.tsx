import { Link, useParams } from 'react-router-dom'
import { Empty, TopBar } from '../../components/ui'
import { productById } from '../../data/sampleData'
import { useDb } from '../../services/db'
import { ProductView } from './ProductView'

/** /product/:id — every card in the app links here. */
export function ProductDetail() {
  const { id = '' } = useParams()
  useDb() // re-render when a published item is (un)registered
  const p = productById(id)
  if (!p) return (
    <>
      <TopBar title="ไม่พบผลงาน" />
      <Empty icon="search" title="ไม่พบผลงานนี้" text="อาจถูกปิดการขายไปแล้ว หรือลิงก์ไม่ถูกต้อง" action={<Link to="/search" className="btn btn-p btn-sm" style={{ marginTop: 8 }}>ไปค้นหาผลงานอื่น</Link>} />
    </>
  )
  return <ProductView key={p.id} p={p} />
}
