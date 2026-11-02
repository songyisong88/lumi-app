/**
 * Feature switches. Money features that need a real payment provider stay OFF
 * until payments, payouts and refunds run on a backend (structure review B14).
 */
export const FEATURES = {
  /** Tips to creators (free items, after a free hire). */
  tips: false,
  /** LUMI-funded discount codes (creator codes such as PIM15 stay on). */
  platformCoupons: false,
} as const
