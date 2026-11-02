import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/Header'
import { Stage } from './components/Stage'
import { Empty, Toaster } from './components/ui'
import { FavoritesProvider } from './services/FavoritesContext'
import { Home } from './pages/Home'
import { lazy, Suspense, type ComponentType } from 'react'
import { FEATURES } from './config'

/** Route-level code splitting: Home ships in the main bundle, every other page is its own chunk.
 *  All chunks are prefetched once the browser is idle, so later navigations never wait. */
const loaders: (() => Promise<unknown>)[] = []
function lz<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) {
  loaders.push(load)
  return lazy(async () => ({ default: (await load())[name] as ComponentType }))
}
const Search = lz(() => import('./pages/Search'), 'Search')
const Favorites = lz(() => import('./pages/Favorites'), 'Favorites')
const StoryViewer = lz(() => import('./pages/StoryViewer'), 'StoryViewer')
const ProductDetail = lz(() => import('./pages/product/ProductDetail'), 'ProductDetail')
const Cart = lz(() => import('./pages/shop/Cart'), 'Cart')
const Checkout = lz(() => import('./pages/shop/Cart'), 'Checkout')
const Notifications = lz(() => import('./pages/shop/Notifications'), 'Notifications')
const Inbox = lz(() => import('./pages/chat/Inbox'), 'Inbox')
const Thread = lz(() => import('./pages/chat/Thread'), 'Thread')
const Profile = lz(() => import('./pages/profile/Profile'), 'Profile')
const CreatorPage = lz(() => import('./pages/profile/Profile'), 'CreatorPage')
const Community = lz(() => import('./pages/community/Community'), 'Community')
const Activities = lz(() => import('./pages/community/More'), 'Activities')
const PostDetail = lz(() => import('./pages/community/More'), 'PostDetail')
const Room = lz(() => import('./pages/community/More'), 'Room')
const Compose = lz(() => import('./pages/community/Compose'), 'Compose')
const Sell = lz(() => import('./pages/sell/Sell'), 'Sell')
const Drafts = lz(() => import('./pages/sell/Sell'), 'Drafts')
const SellStatus = lz(() => import('./pages/sell/Sell'), 'SellStatus')
const Library = lz(() => import('./pages/library/Library'), 'Library')
const LibraryItem = lz(() => import('./pages/library/Library'), 'LibraryItem')
// real-account screens: only routed when FEATURES.accounts is on (off in the live build until approved)
const SignIn = lz(() => import('./pages/account/Account'), 'SignIn')
const NewPassword = lz(() => import('./pages/account/Account'), 'NewPassword')
const AccountSettings = lz(() => import('./pages/account/Account'), 'AccountSettings')
const ShopOrders = lz(() => import('./pages/account/Account'), 'ShopOrders')
const NewStory = lz(() => import('./pages/account/Account'), 'NewStory')
if (typeof window !== 'undefined') {
  const prefetch = () => loaders.forEach((l) => void l().catch(() => {}))
  const idle = (window as Window & { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1200))
  if (document.readyState === 'complete') idle(prefetch); else window.addEventListener('load', () => idle(prefetch), { once: true })
}

function NotFound() {
  return <div style={{ paddingTop: 80 }}><Empty icon="search" title="ไม่พบหน้านี้" text="ลิงก์อาจผิดหรือหน้านี้ถูกย้ายแล้ว" action={<Link to="/" className="btn btn-p btn-sm">กลับหน้าแรก</Link>} /></div>
}

/** HashRouter: GitHub Pages has no SPA fallback, so deep links use #/path. */
export default function App() {
  return (
    <FavoritesProvider>
      <HashRouter>
        <Stage render={(loc) => (
          <Suspense fallback={<div className="route-wait" aria-busy="true" />}>
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
            <Route path="/library" element={<Library />} />
            <Route path="/library/:id" element={<LibraryItem />} />
            <Route path="/creator/:id" element={<CreatorPage />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/community" element={<Community />} />
            <Route path="/community/new" element={<Compose />} />
            <Route path="/community/post/:id" element={<PostDetail />} />
            <Route path="/community/room/:id" element={<Room />} />
            <Route path="/community/activities" element={<Activities />} />
            {FEATURES.accounts && <>
              <Route path="/account/login" element={<SignIn />} />
              <Route path="/account/password" element={<NewPassword />} />
              <Route path="/account" element={<AccountSettings />} />
              <Route path="/shop/orders" element={<ShopOrders />} />
              <Route path="/story/new" element={<NewStory />} />
            </>}
            <Route path="/sell" element={<Sell />} />
            <Route path="/sell/drafts" element={<Drafts />} />
            <Route path="/sell/status" element={<SellStatus />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        )} />
        <BottomNav />
        <Toaster />
      </HashRouter>
    </FavoritesProvider>
  )
}
