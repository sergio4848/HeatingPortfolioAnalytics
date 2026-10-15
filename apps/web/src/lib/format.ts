export const fmt = (n: number | null | undefined, d = 0) =>
  n == null
    ? "Unavailable"
    : n.toLocaleString("en-GB", { maximumFractionDigits: d });
export const pct = (n: number | null) =>
  n == null ? "Unavailable" : `${n > 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
