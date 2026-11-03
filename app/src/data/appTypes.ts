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
  /** Supabase ids (real accounts only). */
  orderItemId?: string
  reviewId?: string
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
  /** Supabase offer id (quotes from real accounts). */
  offerId?: string
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
  /** Supabase hire job (real accounts only). */
  jobId?: string
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
  /** Reactions by kind (server: reaction_counts / real_reaction_counts). `likes` stays the total. */
  rx?: Partial<Record<ReactKind, number>>
  /** “รู้สึก …” / activity chosen in the composer (e.g. '😊 มีความสุข'). */
  feeling?: string
  /** People tagged with @ (ids + the name written in the text). */
  mentions?: Mention[]
  /** IG/FB options (server columns of the same meaning; RLS enforces them). */
  audience?: Audience
  commentsOff?: boolean
  /** Owner hid the like count (others see no number and no likers list). */
  hideLikes?: boolean
  pinnedAt?: number
  archivedAt?: number
  alt?: string[]
  location?: string
  /** People tagged in the photos (not in the text). */
  tagged?: Mention[]
}
export type Audience = 'public' | 'followers' | 'close_friends' | 'only_me'
export type Who = 'everyone' | 'followers' | 'following' | 'off'
export interface PrivacySettings {
  isPrivate: boolean; activity: boolean
  comments: Who; tags: Who; mentions: Who; storyReplies: Who
  hiddenWords: string[]
}
export type BlockKind = 'block' | 'mute' | 'restrict'

/** The 6 reactions (long-press “ถูกใจ”). Stored in post_likes.kind / comment_likes.kind. */
export type ReactKind = 'like' | 'love' | 'haha' | 'wow' | 'fire' | 'idea'
export interface Mention { id: string; name: string }

export interface Comment { id: string; postId: string; authorId: string; text: string; at: number; likes: number; replyTo?: string; badge?: 'author' | 'buyer'; rx?: Partial<Record<ReactKind, number>>; mentions?: Mention[] }

/** A community group (server table `rooms`). */
export interface Room {
  id: string; name: string; icon: string; color: string; bg: string; members: number; desc: string; cover: string; rules: string[]
  privacy?: 'public' | 'private'
  /** Admin announcement pinned at the top of the group. */
  announcement?: string
  /** Sample number of posts today (demo site only; the real site counts the posts it has). */
  today?: number
}

export interface Notif {
  id: string; kind: 'order' | 'chat' | 'like' | 'follow' | 'system' | 'community' | 'sale'; text: string; at: number; link: string; read: boolean; avatar?: string; image?: string
  /** Finer type for the new community notices (server notifications.sub). */
  sub?: 'reaction' | 'reply' | 'mention' | 'group_invite' | 'story_reaction' | 'story_reply'
  /** Emoji shown on the avatar (server notifications.badge). */
  badge?: string
  /** Name of the person who caused it (shown bold). */
  actor?: string
}

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
  /** Real reviews of real listings (Supabase), by product id. */
  cloudReviews?: Record<string, CloudReview[]>
  /** Creator shop: items other people bought from me (real accounts: from Supabase). */
  sales?: Sale[]
  /** Stories I posted (demo keeps them here; real accounts load them from Supabase). */
  stories?: UserStory[]
  /** My reaction on each post / comment (the `liked` / `likedComments` lists stay in sync for older screens). */
  reactions?: Record<string, ReactKind>
  commentReactions?: Record<string, ReactKind>
  /** Group invitations waiting for me. */
  invites?: { roomId: string; by: string; at: number }[]
  /** Groups I asked to join (private groups). */
  requested?: string[]
  /** Posts hidden with ×. */
  hidden?: string[]
  /** My emoji on other people's stories, by story id. */
  storyReactions?: Record<string, string>
  privacy?: PrivacySettings
  blocks?: { id: string; kind: BlockKind }[]
  closeFriends?: string[]
  storyHide?: string[]
  highlights?: { id: string; title: string; items: { storyId: string; media: string; kind: 'image' | 'video' }[] }[]
  /** Composer draft (Instagram keeps drafts on the device). */
  postDraft?: { text: string; images: string[]; alt: string[]; audience: Audience; location: string; tagged: Mention[]; at: number }
}

export interface Sale {
  id: string; orderNo: string; at: number; buyerId: string; productId?: string; title: string; optionLabel?: string
  gross: number; fee: number; net: number
  /** held = waiting (hire: until the buyer accepts; others: until the refund window ends), released = in the next payout, paid_out, refunded, disputed */
  payout: 'held' | 'released' | 'paid_out' | 'refunded' | 'disputed'
  releaseAt?: number; threadId?: string; hire?: boolean
  refund?: { id: string; status: 'open' | 'refunded' | 'declined' | 'escalated'; reason: string; note: string; at: number }
}
export interface UserStory {
  id: string; authorId: string; media: string; kind: 'image' | 'video'; caption: string; at: number; expires: number; views: number; productId?: string
  /** Optional link button label (ดูสินค้า / ดูผลงาน / รับฟรี / จ้างเลย); only with a product. */
  linkLabel?: StoryLinkLabel
  /** Text / sticker / mention layers. Pictures have them baked in (only tap targets are used); videos draw them live. */
  overlays?: StoryOverlay[]
  durationMs?: number
  audience?: 'public' | 'close_friends'
  allowReplies?: 'everyone' | 'following' | 'off'
}
export type StoryLinkLabel = 'ดูสินค้า' | 'ดูผลงาน' | 'รับฟรี' | 'จ้างเลย'
/** One layer on a story. x/y = centre as a fraction of the 9:16 frame, s = scale, r = rotation (deg). */
export interface StoryOverlay {
  id: string; t: 'text' | 'sticker' | 'mention' | 'emoji' | 'media'
  text: string; x: number; y: number; s: number; r: number
  /** text alignment (l / c / r), default centre. */
  al?: 'l' | 'c' | 'r'
  /** layer box measured in the editor (CSS px, before scale) so the saved picture matches the screen exactly. */
  m?: { w: number; h: number; fs: number; fw: number; lh: number; px: number; py: number; br: number }
  /** t = 'media' (clips only): the clip's natural size and the 2 background colours behind it. */
  nw?: number; nh?: number; bg?: string[]
  /** text style: 0 box, 1 plain, 2 neon. */
  st?: number; color?: string
  /** mention: the tagged person. */
  uid?: string
  /** true when the picture already shows this layer (images). */
  baked?: boolean
}
/** Who saw / reacted to my story (author only, 48 h). */
export interface StoryActivity { userId: string; at: number; emoji?: string; clicked?: boolean; replied?: boolean }

export interface CloudReview { id: string; authorId: string; stars: number; text: string; at: number; reply?: string }
