/**
 * Feature switches. Money features that need a real payment provider stay OFF
 * until payments, payouts and refunds run on a backend (structure review B14).
 */
export const FEATURES = {
  /** Tips to creators (free items, after a free hire). */
  tips: false,
  /** LUMI-funded discount codes (creator codes such as PIM15 stay on). */
  platformCoupons: false,
  /** Real accounts (Supabase sign-in, account settings, stories, post edit, shop orders).
   *  Approved by the owner 2026-11-02 and ON in the live build (.env.production VITE_FEATURE_ACCOUNTS=1).
   *  The sample persona stays available as “ลองใช้แบบตัวอย่าง”. */
  accounts: import.meta.env.VITE_FEATURE_ACCOUNTS === '1',
  /** Launch rules approved 2026-11-02 (backend-plan §10), shown in the UI: free items only at first,
   *  no "data" type, courses = e-book only, file cap 1.9 GB, hire = post + chat (payment later),
   *  refund after download only for broken / not-as-described. The SERVER already enforces these;
   *  this flag only changes what the screens show. Approved 2026-11-02, ON live (VITE_FEATURE_LAUNCH=1). */
  launch: import.meta.env.VITE_FEATURE_LAUNCH === '1',
} as const

/** Two sites from one code base (owner, 2026-11-03):
 *  - REAL (default build, /lumi-app/app/): only real server data. No sample works, posts, stories, creators,
 *    sample notes or “ลองใช้แบบตัวอย่าง”; content by test accounts (profiles.is_test) is hidden.
 *  - DEMO (VITE_SITE=demo, /lumi-app/demo/): today's app with the sample data, the sample persona and the
 *    test accounts. All QA writes happen there. */
export const DEMO_SITE = import.meta.env.VITE_SITE === 'demo'
export const REAL = FEATURES.accounts && !DEMO_SITE
/** Social sign-in buttons on the sign-in / sign-up screens (option B, owner 2026-11-03).
 *  Each one stays HIDDEN until its provider is set up in the Supabase dashboard, so no dead button is shown:
 *  google  → Auth › Providers › Google (Google Cloud OAuth client)          VITE_AUTH_GOOGLE=1
 *  line    → Auth › Providers › custom OAuth2 provider id `custom:line`      VITE_AUTH_LINE=1
 *  facebook→ Auth › Providers › Facebook (Meta developer app)                VITE_AUTH_FACEBOOK=1
 *  apple   → Auth › Providers › Apple (Apple Developer account)              VITE_AUTH_APPLE=1 */
export type SocialId = 'google' | 'line' | 'facebook' | 'apple'
export const SOCIALS: SocialId[] = ['google', 'line', 'facebook', 'apple']
export const SOCIAL: Record<SocialId, boolean> = {
  google: import.meta.env.VITE_AUTH_GOOGLE === '1',
  line: import.meta.env.VITE_AUTH_LINE === '1',
  facebook: import.meta.env.VITE_AUTH_FACEBOOK === '1',
  apple: import.meta.env.VITE_AUTH_APPLE === '1',
}
/** “ลองใช้แบบตัวอย่าง” on the sign-in screen. */
export const SHOW_DEMO = !REAL
