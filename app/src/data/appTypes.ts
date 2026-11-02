/** Shapes for the local (localStorage) database. Mirror these as Supabase tables later. */
import type { ListingDraft } from './listingSpec'
import type { Product } from './types'

export interface CartItem {
  key: string
  productId: string
  optionId?: string
  optionLabel?: string
  price: number
  /** Custom lines (accepted offer in chat, tip). */
  title?: string
  image?: string
  creatorId?: string
  offerThreadId?: string
  offerMsgId?: string
  /** Buy-now / tip / accepted offer: goes straight to checkout, never shown in the cart. */
  direct?: boolean
}

export interface Order { id: string; no: string; items: CartItem[]; total: number; discount: number; at: number; method: string }

export interface Purchase {
  id: string
  productId: string
  orderNo: string
  optionLabel?: string
  at: number
  title: string
  image?: string
  creatorId: string
  price: number
  key?: string
  threadId?: string
  /** What the buyer got: files, keys, prompts and links. Shown in คลังของที่ซื้อ (/library), not in chat. */
  assets?: Asset[]
  /** Buyer reported a problem / asked for a refund (local only until moderation exists). */
  issue?: Issue
  /** Buyer's own review of this purchase (editable). */
  review?: { stars: number; text: string; at: number }
}

export interface Asset { kind: 'file' | 'key' | 'prompt' | 'link'; title: string; value: string; size?: string }

export interface Issue { reason: string; note: string; at: number; status: string }

export type MsgKind = 'text' | 'brief' | 'offer' | 'progress' | 'delivery' | 'key' | 'file' | 'product' | 'system' | 'sticker' | 'tip' | 'coupon' | 'typing'

export interface Message {
  id: string
  from: 'me' | 'them' | 'system'
  kind: MsgKind
  text?: string
  at: number
  title?: string
  items?: string[]
  amount?: number
  status?: 'pending' | 'accepted' | 'declined' | 'revise'
  image?: string
  round?: number
  left?: number
  pct?: number
  code?: string
  fileName?: string
  size?: string
  productId?: string
  /** System message: in-app link shown as a button (e.g. /library/b1). */
  link?: string
  linkLabel?: string
  /** Delivery: buyer asked for 3 more days to check the work. */
  extended?: boolean
}

export interface Thread {
  id: string
  partnerId: string
  /** 'creator' = I am buying from them; 'customer' = they buy from me. */
  role: 'creator' | 'customer'
  title: string
  image?: string
  productId?: string
  orderNo?: string
  amount?: number
  hire?: boolean
  /** Index in HIRE_STEPS for hire orders. */
  step?: number
  status: string
  tone: 'warn' | 'info' | 'ok' | 'done'
  unread: number
  online: boolean
  quick: string[]
  updatedAt: number
  pinned?: boolean
  muted?: boolean
  issue?: Issue
}

export const HIRE_STEPS = ['บรีฟ', 'ใบเสนอราคา', 'ชำระเงิน', 'กำลังทำ', 'ส่งงาน', 'รีวิว'] as const

export type PostTag = 'โชว์ผลงาน' | 'ความรู้' | 'เบื้องหลัง' | 'ถาม-ตอบ' | 'แจกฟรี'

export interface Post {
  id: string
  authorId: string
  at: number
  tag: PostTag
  text: string
  images: string[]
  productIds: string[]
  prompt?: string
  code?: string[]
  roomId?: string
  likes: number
  comments: number
  shares: number
  hireButton?: boolean
  mine?: boolean
}

export interface Comment { id: string; postId: string; authorId: string; text: string; at: number; likes: number; replyTo?: string; badge?: 'author' | 'buyer' }

export interface Room { id: string; name: string; icon: string; color: string; bg: string; members: number; desc: string; cover: string; rules: string[] }

export interface Notif { id: string; kind: 'order' | 'chat' | 'like' | 'follow' | 'system' | 'community' | 'sale'; text: string; at: number; link: string; read: boolean; avatar?: string; image?: string }

export interface DB {
  v: number
  follows: string[]
  cart: CartItem[]
  orders: Order[]
  purchases: Purchase[]
  threads: Thread[]
  messages: Record<string, Message[]>
  posts: Post[]
  liked: string[]
  saved: string[]
  comments: Comment[]
  likedComments: string[]
  joined: string[]
  votes: string[]
  notifs: Notif[]
  drafts: ListingDraft[]
  published: Product[]
  missions: string[]
  /** creator replies to reviews, key `${productId}:${reviewIndex}` */
  replies?: Record<string, string>
}
