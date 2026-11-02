import { HashRouter, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/Header'
import { FavoritesProvider } from './services/FavoritesContext'
import { Favorites } from './pages/Favorites'
import { Home } from './pages/Home'
import { Placeholder } from './pages/Placeholder'
import { Search } from './pages/Search'
import { StoryViewer } from './pages/StoryViewer'

const soon = 'หน้านี้กำลังออกแบบ จะเปิดใช้เร็ว ๆ นี้'

/** HashRouter: GitHub Pages has no SPA fallback, so deep links use #/path. */
export default function App() {
  return (
    <FavoritesProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/story/:creatorId" element={<StoryViewer />} />
          <Route path="/search" element={<Search />} />
          <Route path="/product/:id" element={<Placeholder title="สินค้า" note="หน้ารายละเอียดสินค้า ราคา และปุ่มซื้อ กำลังออกแบบ" />} />
          <Route path="/sell" element={<Placeholder title="ลงขาย" note={soon} />} />
          <Route path="/chat" element={<Placeholder title="แชต" note={soon} />} />
          <Route path="/notifications" element={<Placeholder title="แจ้งเตือน" note={soon} />} />
          <Route path="/cart" element={<Placeholder title="ตะกร้า" note={soon} />} />
          <Route path="*" element={<Placeholder title="ไม่พบหน้านี้" note="ลองกลับไปที่หน้าแรก" />} />
        </Routes>
        <BottomNav />
        <div className="sample-badge">ข้อมูลตัวอย่าง</div>
      </HashRouter>
    </FavoritesProvider>
  )
}
