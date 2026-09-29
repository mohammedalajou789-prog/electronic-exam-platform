// src/lib/batch-order.ts
//
// The one ordering rule for batches, used everywhere batch names are listed:
//   1. Newest graduation year first (Hayat 2028 before Vein 2027).
//   2. Batches without a graduation year (e.g. "Previous Batches") last.
//   3. Same year (or both without one): alphabetical by name.

export interface OrderableBatch {
  name: string
  graduation_year: number | null
}

/** Comparator for Array.prototype.sort(). */
export function compareBatches(a: OrderableBatch, b: OrderableBatch): number {
  if (a.graduation_year !== b.graduation_year) {
    if (a.graduation_year === null) return 1
    if (b.graduation_year === null) return -1
    return b.graduation_year - a.graduation_year
  }
  return a.name.localeCompare(b.name)
}

/**
 * Batch names in display order, each name once.
 * (Before the batches restructure the same name could appear on several rows.)
 */
export function uniqueBatchNames(rows: OrderableBatch[]): string[] {
  return [...new Set([...rows].sort(compareBatches).map(b => b.name))]
}