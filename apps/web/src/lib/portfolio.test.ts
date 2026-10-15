import { describe, it, expect } from "vitest";
import type { Building } from "../types";
import {
  matchesBuilding,
  monthlyTotals,
  reportUrl,
  rangeLabel,
  DEFAULT_RANGE,
} from "./portfolio";
const building = {
  id: "SYN-003",
  name: "Building 03",
  building_type: "Panel",
  trace: [
    { evaluation: true, period_start: "2026-02-01", heat_kwh: 250 },
    { evaluation: false, period_start: "2025-01-01", heat_kwh: 900 },
  ],
} as Building;
describe("portfolio evidence selection", () => {
  it("searches the same identity fields used by reports", () => {
    expect(matchesBuilding(building, "  Syn-003  ")).toBe(true);
    expect(matchesBuilding(building, "panel")).toBe(true);
    expect(matchesBuilding(building, "SYN-004")).toBe(false);
  });
  it("sums only evaluation months without losing zero values", () => {
    const other = {
      ...building,
      trace: [
        { ...building.trace[0], heat_kwh: 50 },
        { ...building.trace[0], period_start: "2026-01-01", heat_kwh: 0 },
      ],
    };
    expect(monthlyTotals([building, other])).toEqual([
      { period: "2026-01", heat: 0 },
      { period: "2026-02", heat: 300 },
    ]);
  });
  it("exports the applied period and search for a portfolio", () => {
    const url = reportUrl("csv", DEFAULT_RANGE, {
      kind: "Panel",
      quality: "usable",
      status: "investigate",
      q: "SYN-003",
    });
    const q = new URL(url, "http://localhost").searchParams;
    expect(q.get("start")).toBe("2026-01-01");
    expect(q.get("q")).toBe("SYN-003");
    expect(q.get("kind")).toBe("Panel");
  });
  it("does not let portfolio filters suppress a building report", () => {
    const q = new URL(
      reportUrl(
        "pdf",
        DEFAULT_RANGE,
        {
          kind: "Masonry",
          quality: "usable",
          status: "closed",
          q: "irrelevant",
        },
        "SYN-003",
      ),
      "http://localhost",
    ).searchParams;
    expect(q.get("bid")).toBe("SYN-003");
    expect(q.has("q")).toBe(false);
    expect(q.has("kind")).toBe(false);
  });
  it("labels an ISO date range without local-time month drift", () => {
    expect(rangeLabel(DEFAULT_RANGE)).toBe("Jan 2026 – Sept 2026");
  });
});
