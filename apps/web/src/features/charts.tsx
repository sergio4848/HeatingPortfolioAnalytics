import { useId } from "react";
import {
  AreaChart,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import brand from "../../../../packages/brand/brand.json";
import type { Trace } from "../types";
import { fmt } from "../lib/format";
const tick = { fontSize: 11, fill: "#607481" };
const month = (v: string) =>
  new Date(
    v.length === 7 ? v + "-01T12:00:00Z" : v + "T12:00:00Z",
  ).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
const tooltipStyle = {
  border: "1px solid #dae5e9",
  borderRadius: 10,
  boxShadow: "0 8px 25px #132c3d12",
  fontSize: 12,
};
export function PortfolioChart({
  data,
}: {
  data: { period: string; heat: number }[];
}) {
  const id = useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 15, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={brand.teal} stopOpacity={0.18} />
            <stop offset="100%" stopColor={brand.teal} stopOpacity={0.015} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="#e8eef1"
          strokeDasharray="3 4"
        />
        <XAxis
          dataKey="period"
          tick={tick}
          tickLine={false}
          axisLine={false}
          tickFormatter={month}
          minTickGap={24}
          dy={8}
        />
        <YAxis
          width={55}
          tick={tick}
          tickLine={false}
          axisLine={false}
          tickFormatter={(n) => `${fmt(n / 1000)}k`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(label) => month(String(label))}
          formatter={(v) => [fmt(Number(v)) + " kWh", "Observed heat"]}
        />
        <Area
          isAnimationActive={false}
          dataKey="heat"
          stroke={brand.teal}
          strokeWidth={2.5}
          fill={`url(#${id})`}
          activeDot={{ r: 4, strokeWidth: 3, stroke: "#fff" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
export function HeatChart({
  rows,
  eventMonth,
  evaluationStart,
}: {
  rows: Trace[];
  eventMonth?: string;
  evaluationStart?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={rows}
        margin={{ top: 22, right: 12, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={brand.teal} stopOpacity={0.15} />
            <stop offset="100%" stopColor={brand.teal} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="#e8eef1"
          strokeDasharray="3 4"
        />
        <XAxis
          dataKey="period_start"
          tick={tick}
          tickLine={false}
          axisLine={false}
          tickFormatter={month}
          minTickGap={35}
          dy={8}
        />
        <YAxis
          width={55}
          tick={tick}
          tickLine={false}
          axisLine={false}
          tickFormatter={(n) => `${fmt(n / 1000)}k`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(label) => month(String(label))}
          formatter={(v) => fmt(Number(v)) + " kWh"}
        />
        {evaluationStart &&
          rows.some((r) => r.period_start === evaluationStart) && (
            <ReferenceArea
              x1={evaluationStart}
              x2={rows.at(-1)?.period_start}
              fill="#edf5f4"
              fillOpacity={0.6}
            />
          )}
        <Area
          name="Observed"
          isAnimationActive={false}
          dataKey="heat_kwh"
          stroke={brand.teal}
          strokeWidth={2.5}
          fill={`url(#${id})`}
        />
        <Line
          name="Weather reference"
          isAnimationActive={false}
          dataKey="expected_kwh"
          stroke={brand.navy}
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
        />
        {evaluationStart &&
          rows.some((r) => r.period_start === evaluationStart) && (
            <ReferenceLine
              x={evaluationStart}
              stroke="#859da5"
              strokeDasharray="3 3"
              label={{
                value: "Evaluation",
                fontSize: 10,
                fill: "#526776",
                position: "insideTopRight",
              }}
            />
          )}
        {eventMonth && (
          <ReferenceLine
            x={eventMonth}
            stroke="#80520b"
            label={{
              value: "Event month",
              fontSize: 10,
              fill: "#80520b",
              position: "insideTopRight",
            }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
