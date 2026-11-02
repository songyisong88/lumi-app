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
   *  OFF in the live build until the owner approves the new screens: the live app stays the
   *  approved demo. Turn on for a preview build with VITE_FEATURE_ACCOUNTS=1. */
  accounts: import.meta.env.VITE_FEATURE_ACCOUNTS === '1',
  /** Launch rules approved 2026-11-02 (backend-plan §10), shown in the UI: free items only at first,
   *  no "data" type, courses = e-book only, file cap 1.9 GB, hire = post + chat (payment later),
   *  refund after download only for broken / not-as-described. The SERVER already enforces these;
   *  this flag only changes what the screens show, so it stays OFF live until approved.
   *  Preview with VITE_FEATURE_LAUNCH=1. */
  launch: import.meta.env.VITE_FEATURE_LAUNCH === '1',
} as const
