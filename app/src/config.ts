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
