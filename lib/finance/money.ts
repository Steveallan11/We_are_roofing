export type MoneyInput = unknown;

/** Convert a database numeric/decimal to integer pennies without binary-float maths. */
export function toPence(value: MoneyInput): number {
  if (typeof value === "bigint") return Number(value) * 100;
  const raw = String(value ?? "0").trim().replaceAll(",", "");
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return 0;
  const negative = raw.startsWith("-");
  const [wholeRaw, fractionRaw = ""] = raw.replace("-", "").split(".");
  const roundedThird = Number(fractionRaw[2] ?? "0") >= 5;
  let pennies = Number(wholeRaw) * 100 + Number((fractionRaw + "00").slice(0, 2));
  if (roundedThird) pennies += 1;
  return negative ? -pennies : pennies;
}

export function fromPence(pence: number): number {
  return Number((pence / 100).toFixed(2));
}

export function sumPence(values: MoneyInput[]): number {
  return values.reduce<number>((sum, value) => sum + toPence(value), 0);
}

export function formatGbp(value: MoneyInput): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(fromPence(toPence(value)));
}

export function percent(numeratorPence: number, denominatorPence: number): number {
  if (denominatorPence === 0) return 0;
  return Number(((numeratorPence * 100) / denominatorPence).toFixed(2));
}

export function decimalMultiply(quantity: unknown, unitValue: MoneyInput): number {
  const quantityScaled = Math.round(Number(quantity ?? 0) * 10_000);
  if (!Number.isSafeInteger(quantityScaled)) throw new Error("Quantity is outside the supported range.");
  return Math.round((quantityScaled * toPence(unitValue)) / 10_000);
}
