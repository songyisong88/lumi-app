/** Product kinds shown in the feed. Each kind renders its own ProductCard variant. */
export type ProductKind = 'image' | 'template' | 'tool' | 'bot' | 'course' | 'commission'

/** Filter-chip type keys (row 2). Several kinds can share one type chip. */
export type TypeKey = 'img' | 'tpl' | 'tool' | 'bot' | 'course' | 'svc'

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
}

export interface ComingSoon {
  id: string
  icon: string
  title: string
  use: string
  waiting: number
}

export interface StorySlide {
  productId: string
  postedAgo: string
}

export interface Story {
  creatorId: string
  slides: StorySlide[]
}
