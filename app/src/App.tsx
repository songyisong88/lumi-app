import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/Header'
import { Stage } from './components/Stage'
import { Empty, Toaster } from './components/ui'
import { FavoritesProvider } from './services/FavoritesContext'
import { Favorites } from './pages/Favorites'
import { Home } from './pages/Home'
import { Search } from './pages/Search'
import { StoryViewer } from './pages/StoryViewer'
import { ProductDetail } from './pages/product/ProductDetail'
import { Cart, Checkout } from './pages/shop/Cart'
import { Notifications } from './pages/shop/Notifications'
import { Inbox } from './pages/chat/Inbox'
import { Thread } from './pages/chat/Thread'
import { CreatorPage, Profile } from './pages/profile/Profile'
import { Community } from './pages/community/Community'
import { Activities, PostDetail, Room } from './pages/community/More'
import { Compose } from './pages/community/Compose'
import { Drafts, Sell } from './pages/sell/Sell'

function NotFound() {
  return <div style={{ paddingTop: 80 }}><Empty icon="search" title="ไม่พบหน้านี้" text="ลิงก์อาจผิดหรือหน้านี้ถูกย้ายแล้ว" action={<Link to="/" className="btn btn-p btn-sm">กลับหน้าแรก</Link>} /></div>
}

/** HashRouter: GitHub Pages has no SPA fallback, so deep links use #/path. */
export default function App() {
  return (
    <FavoritesProvider>
      <HashRouter>
        <Stage render={(loc) => (
          <Routes location={loc}>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/story/:creatorId" element={<StoryViewer />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/chat" element={<Inbox />} />
            <Route path="/chat/:id" element={<Thread />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/creator/:id" element={<CreatorPage />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/community" element={<Community />} />
            <Route path="/community/new" element={<Compose />} />
            <Route path="/community/post/:id" element={<PostDetail />} />
            <Route path="/community/room/:id" element={<Room />} />
            <Route path="/community/activities" element={<Activities />} />
            <Route path="/sell" element={<Sell />} />
            <Route path="/sell/drafts" element={<Drafts />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        )} />
        <BottomNav />
        <Toaster />
        <div className="sample-badge">ข้อมูลตัวอย่าง</div>
      </HashRouter>
    </FavoritesProvider>
  )
}
