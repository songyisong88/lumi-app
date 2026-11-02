import { COMING_SOON } from '../data/sampleData'
import { ComingSoonCard } from './ProductCard'
import s from './ComingSoonBand.module.css'

export function ComingSoonBand() {
  return (
    <section className={s.band}>
      <h2 className={s.h}>เร็ว ๆ นี้ใน LUMI</h2>
      <p className={s.sub}>เกม ซอฟต์แวร์ ส่วนเสริม และปลั๊กอิน ผ่านการตรวจไวรัสทุกชิ้น</p>
      <div className={`hscroll ${s.shelf}`}>{COMING_SOON.map((c) => <ComingSoonCard key={c.id} c={c} />)}</div>
    </section>
  )
}
