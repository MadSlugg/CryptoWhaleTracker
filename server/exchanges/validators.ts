// Shared validation helpers for filtering whale orders across all exchanges

// Price validation helper to filter out stale/outlier orders
// Only accept prices within ±20% of current market price
export function isValidPrice(price: number, referencePrice: number): boolean {
  const deviation = Math.abs(price - referencePrice) / referencePrice;
  return deviation <= 0.20; // 20% tolerance
}

// Validate that total value makes sense (prevents parsing errors)
// For whale orders, total should be between $840k and $100M (10+ BTC at $84k)
export function isValidTotal(total: number): boolean {
  return total >= 840000 && total <= 100000000; // $840k to $100M
}

// Validate that total approximately equals price * quantity
// This catches parsing errors where we might multiply wrong fields
export function isValidCalculation(price: number, quantity: number, total: number): boolean {
  const expectedTotal = price * quantity;
  const deviation = Math.abs(expectedTotal - total) / expectedTotal;
  return deviation < 0.01; // 1% tolerance for rounding
}
