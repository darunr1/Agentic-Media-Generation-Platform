/** All money is stored as integer USD cents to avoid floating-point drift. */
export type Cents = number;

export function formatCents(cents: Cents): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function addCents(...values: Cents[]): Cents {
  return values.reduce((sum, v) => sum + v, 0);
}

export function dollarsToCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}
