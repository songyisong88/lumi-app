/** Product kinds shown in the feed. Each kind renders its own ProductCard variant. */
export type ProductKind = 'image' | 'template' | 'tool' | 'bot' | 'course' | 'commission'

/** Filter-chip type keys (row 2). Several kinds can share one type chip. */
export type TypeKey = 'img' | 'tpl' | 'tool' | 'bot' | 'course' | 'svc' | 'media' | 'skill' | 'data'

export interface Creator {
  id: string
  name: string
  avatar: string // file name in public/img
}

export interface Product {
  id: string
  kind: ProductKind
  type: TypeKey
  /** Sub-label on the type tag, e.g. "สติกเกอร์ LINE". Falls back to the type name. */
  label?: string
  title: string
  /** The "ใช้ทำอะไร" line. */
  use: string
  creatorId: string
  /** Price in THB. 0 = free. Not shown in the feed; used on detail/story and for filters. */
  price: number
  priceSuffix?: string
  /** Image file in public/img plus its real pixel size (drives the masonry aspect ratio). */
  image?: { src: string; w: number; h: number }
  /** For cards without a photo (tool, bot) a fixed aspect ratio, as "w/h". */
  ratio?: string
  hasPrompt?: boolean
  tryable?: boolean
  instant?: boolean
  // kind-specific extras
  gradient?: string
  icon?: string
  platforms?: string[]
  rating?: number
  files?: string[]
  chat?: { q: string; a: string }
  meta?: string // course length / ebook pages
  video?: boolean
  freeFirst?: string // e.g. "บทแรกฟรี"
  days?: number
  revisions?: number
  // set on works published from the sell wizard (local service)
  /** Which product-page layout to use. Derived from kind/label when absent. */
  dk?: DetailKind
  options?: ProductOption[]
  desc?: string
  tags?: string[]
  mine?: boolean
  createdAt?: number
  covers?: string[] // data URLs or img file names
  /** Sell type + answers from the listing spec (see listingSpec.ts). */
  st?: import('./listingSpec').SellType
  spec?: import('./listingSpec').Spec
}

/** The 8 product-page layouts (approved product-b). */
export type DetailKind = 'img' | 'tpl' | 'sw' | 'bot' | 'course' | 'font' | 'hire' | 'free' | 'media' | 'skill' | 'data'

export interface ProductOption {
  id: string
  label: string
  sub: string
  price: number
  suffix?: string
  best?: string
}

export interface StorySlide {
  productId: string
  postedAgo: string
}

export interface Story {
  creatorId: string
  slides: StorySlide[]
}
