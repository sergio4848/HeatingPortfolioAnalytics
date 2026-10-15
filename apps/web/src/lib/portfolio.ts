import type { Building } from "../types";
export type DateRange = { start: string; end: string };
export const DEFAULT_RANGE: DateRange = {
  start: "2026-01-01",
  end: "2026-09-30",
};
export const matchesBuilding = (b: Building, query: string) =>
  `${b.id} ${b.name} ${b.building_type}`
    .toLowerCase()
    .includes(query.trim().toLowerCase());
export function reportUrl(
  format: "csv" | "pdf",
  range: DateRange,
  filters: { kind: string; quality: string; status: string; q: string },
  bid = "",
) {
  // A building report is independent of portfolio search/type filters.
  const params = new URLSearchParams({
    ...range,
    ...(bid ? { bid } : filters),
  });
  return `/api/reports/${format}?${params}`;
}
export function monthlyTotals(buildings: Building[]) {
  const months = new Map<string, number>();
  for (const building of buildings)
    for (const row of building.trace)
      if (row.evaluation)
        months.set(
          row.period_start,
          (months.get(row.period_start) ?? 0) + row.heat_kwh,
        );
  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, heat]) => ({ period: date.slice(0, 7), heat }));
}
export function rangeLabel(range: DateRange) {
  const format = (value: string) =>
    new Date(value + "T12:00:00Z").toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  return `${format(range.start)} – ${format(range.end)}`;
}
