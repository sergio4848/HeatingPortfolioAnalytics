import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AreaChart,
  Area,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  ArrowUpRight,
  ArrowRight,
  Building2,
  LayoutDashboard,
  Upload,
  ClipboardList,
  Settings,
  Activity,
  Download,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileCheck2,
} from "lucide-react";
import brand from "../../../packages/brand/brand.json";
import "./style.css";

type Trace = {
  period_start: string;
  heat_kwh: number;
  expected_kwh: number | null;
  hdd: number;
  coverage: number;
  evaluation: boolean;
  flagged: boolean;
  residual_kwh: number | null;
};
type Building = {
  id: string;
  name: string;
  heated_area_m2: number;
  building_type: string;
  quality: string;
  status: string;
  priority: number;
  observed_kwh: number;
  expected_kwh: number | null;
  residual_kwh: number | null;
  deviation: number | null;
  intensity_kwh_m2: number;
  missing_months: number;
  reason: string;
  limitations: string[];
  quality_issues: string[];
  flagged_months: string[];
  model: null | {
    training_start: string;
    training_end: string;
    training_months: number;
    base_kwh_day: number;
    heating_kwh_hdd: number;
    training_mae_kwh: number;
  };
  trace: Trace[];
};
type Task = {
  id: string;
  building_id: string;
  status: string;
  assignee: string;
  note: string;
  technical_action: string;
  priority: string;
  due: string | null;
  history: { at: string; status: string; note: string }[];
};
type Intervention = {
  id: string;
  building_id: string;
  kind: string;
  start: string;
  end: string;
  scope: string;
  expected_effect: string;
  cost: number | null;
  cost_source: string;
  notes: string;
};
type Portfolio = {
  items: Building[];
  total: number;
  method: string;
  disclosure: string;
  organization: { name: string; threshold: number; unit: string };
  tasks: Task[];
  interventions: Intervention[];
};
type Preview = {
  id: string;
  headers: string[];
  preview: Record<string, unknown>[];
  issues: { row: number | string; building: string; message: string }[];
  total_rows: number;
  conflicts: string[];
};
const fmt = (n: number | null | undefined, d = 0) =>
  n == null
    ? "Unavailable"
    : n.toLocaleString("en-GB", { maximumFractionDigits: d });
const pct = (n: number | null) =>
  n == null ? "Unavailable" : `${n > 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch("/api" + path, {
    ...options,
    headers:
      options.body instanceof FormData
        ? options.headers
        : { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : JSON.stringify(data.detail),
    );
  }
  return res.json();
}
const json = (method: string, data: unknown) => ({
  method,
  body: JSON.stringify(data),
});
const Status = ({ value }: { value: string }) => (
  <span
    className={
      "status " +
      (value === "investigate"
        ? "warn"
        : value === "within reference"
          ? "good"
          : "neutral")
    }
  >
    {value === "investigate" ? (
      <AlertTriangle size={13} />
    ) : value === "within reference" ? (
      <CheckCircle2 size={13} />
    ) : (
      <Activity size={13} />
    )}{" "}
    {value}
  </span>
);

function App() {
  const [page, setPage] = useState("home"),
    [data, setData] = useState<Portfolio | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState("");
  const [start, setStart] = useState("2026-01-01"),
    [end, setEnd] = useState("2026-09-30"),
    [type, setType] = useState(""),
    [quality, setQuality] = useState(""),
    [status, setStatus] = useState("");
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [policy, setPolicy] = useState("reject");
  const [task, setTask] = useState<Task | null>(null),
    [audit, setAudit] = useState<unknown[]>([]);
  const [orgName, setOrgName] = useState(""),
    [threshold, setThreshold] = useState(0.2);
  const [intervention, setIntervention] = useState({
    building_id: "SYN-007",
    kind: "",
    start: "2026-09-01",
    end: "2026-09-15",
    scope: "",
    expected_effect: "",
    cost: "",
    cost_source: "",
    notes: "",
  });
  async function load() {
    const d = await api<Portfolio>(`/portfolio?start=${start}&end=${end}`);
    setData(d);
    setOrgName(d.organization.name);
    setThreshold(d.organization.threshold);
  }
  async function run(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void run(async () => {
      try {
        await api("/session");
      } catch {
        await api("/session", { method: "POST" });
      }
      await load();
    });
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const buildings = data?.items ?? [],
    filtered = buildings.filter(
      (b) =>
        (!type || b.building_type === type) &&
        (!quality || b.quality === quality) &&
        (!status || b.status === status),
    );
  const current = buildings.find((b) => b.id === selected);
  const params = new URLSearchParams({
    start,
    end,
    kind: type,
    quality,
    status,
  });
  const report = (format: string, bid = "") =>
    `/api/reports/${format}?${new URLSearchParams({ ...Object.fromEntries(params), bid })}`;
  const total = filtered.reduce((s, b) => s + b.observed_kwh, 0);
  const aggregate = Object.values(
    filtered.reduce<Record<string, { period: string; heat: number }>>(
      (acc, b) => {
        b.trace
          .filter((t) => t.evaluation)
          .forEach((t) => {
            acc[t.period_start] ??= {
              period: t.period_start.slice(0, 7),
              heat: 0,
            };
            acc[t.period_start].heat += t.heat_kwh;
          });
        return acc;
      },
      {},
    ),
  ).sort((a, b) => a.period.localeCompare(b.period));
  const nav = [
    ["portfolio", "Portfolio", LayoutDashboard],
    ["import", "Import data", Upload],
    ["tasks", "Review tasks", ClipboardList],
    ["monitoring", "Interventions", Activity],
    ["settings", "Settings", Settings],
  ] as const;
  function openBuilding(id: string) {
    setSelected(id);
    setPage("building");
    window.scrollTo(0, 0);
  }
  function newTask(bid: string) {
    setTask({
      id: "",
      building_id: bid,
      status: "new",
      assignee: "Demo analyst role",
      note: "",
      technical_action: "Check meter and invoice records",
      priority: "high",
      due: null,
      history: [],
    });
    setPage("tasks");
  }
  async function previewFile() {
    if (!file) throw new Error("Select a CSV or macro-free XLSX file");
    const form = new FormData();
    form.set("file", file);
    form.set("mapping", JSON.stringify(mapping));
    setPreview(
      await api<Preview>("/imports/preview", { method: "POST", body: form }),
    );
  }
  const Title = ({
    eyebrow,
    title,
    subtitle,
    children,
  }: {
    eyebrow: string;
    title: string;
    subtitle: string;
    children?: React.ReactNode;
  }) => (
    <header className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
      </div>
      <div className="actions">{children}</div>
    </header>
  );
  const Downloads = ({ bid = "" }: { bid?: string }) => (
    <>
      <a className="button secondary" href={report("csv", bid)} download>
        <Download size={16} /> Findings CSV
      </a>
      <a className="button" href={report("pdf", bid)} download>
        <Download size={16} /> Evidence PDF
      </a>
    </>
  );
  return (
    <>
      <div className="disclosure">
        <span className="demo-dot" />{" "}
        {data?.disclosure ??
          "Synthetic demo data — not measured customer results"}
        <span className="disclosure-right">LOCAL DEMO · MONTHLY ANALYSIS</span>
      </div>
      {page === "home" ? (
        <>
          <nav className="landing-nav">
            <a className="brand" href="#" onClick={() => setPage("home")}>
              <img src="/symbol.svg" alt="" />
              {brand.name}
              <small>PROVISIONAL</small>
            </a>
            <a href="#pilot">
              Pilot scope <ArrowUpRight size={15} />
            </a>
          </nav>
          <main className="landing">
            <section className="hero">
              <div>
                <p className="eyebrow">HEATING PORTFOLIO ANALYTICS</p>
                <h1>
                  Know which building
                  <br />
                  to look at <em>first.</em>
                </h1>
                <p className="lead">
                  Prioritize buildings for investigation using existing heat
                  consumption data. Understand the evidence before you act.
                </p>
                <button
                  onClick={() => setPage("portfolio")}
                  disabled={!data || busy}
                >
                  Explore the demo <ArrowRight size={18} />
                </button>
                <p className="small muted">
                  12 synthetic buildings · No new sensors required · Human
                  review
                </p>
              </div>
              <div className="hero-preview">
                <div className="preview-label">
                  <span>PORTFOLIO / INVESTIGATION QUEUE</span>
                  <Activity size={18} />
                </div>
                <h2>
                  One portfolio.
                  <br />A clearer starting point.
                </h2>
                {buildings.slice(0, 3).map((b) => (
                  <button
                    className="preview-row"
                    key={b.id}
                    onClick={() => openBuilding(b.id)}
                  >
                    <span className="building-icon">
                      <Building2 />
                    </span>
                    <span>
                      <strong>{b.name}</strong>
                      <small>
                        {b.id} · {b.quality}
                      </small>
                    </span>
                    <Status value={b.status} />
                    <ArrowUpRight size={16} />
                  </button>
                ))}
                <p className="small">
                  Live calculations from a deterministic synthetic dataset.
                </p>
              </div>
            </section>
            <section className="how">
              <p className="eyebrow">FROM FILES TO FOLLOW-UP</p>
              <h2>A review process you can explain.</h2>
              <div className="three">
                {[
                  [
                    "01",
                    "Bring existing data",
                    "Import monthly CSV or XLSX records. See missing values, duplicates and unit issues before analysis.",
                  ],
                  [
                    "02",
                    "Understand the difference",
                    "Compare each building with its own history and weather reference. Keep data limitations visible.",
                  ],
                  [
                    "03",
                    "Record the next step",
                    "Assign a review, document an intervention and export the evidence for a conversation.",
                  ],
                ].map(([n, h, p]) => (
                  <article key={n}>
                    <span>{n}</span>
                    <h3>{h}</h3>
                    <p>{p}</p>
                  </article>
                ))}
              </div>
            </section>
            <section id="pilot" className="pilot">
              <div>
                <p className="eyebrow">PROPOSED PILOT</p>
                <h2>
                  5–10 buildings.
                  <br />
                  Six weeks of retrospective review.
                </h2>
              </div>
              <div>
                <p>
                  For professional apartment management companies in Latvia. The
                  initial 20–100 building target segment is a hypothesis to
                  validate.
                </p>
                <p>
                  Deliverables: data quality report, review priorities, expert
                  feedback and a decision about further monitoring. Annual
                  savings need longer observation and a separate verification
                  method.
                </p>
                <button
                  className="secondary"
                  onClick={() => setPage("monitoring")}
                >
                  View demo interventions <ArrowRight size={16} />
                </button>
              </div>
            </section>
            <section className="faq">
              <h2>Before the first review</h2>
              {[
                [
                  "Does it control heating equipment?",
                  "No. A manager or qualified expert reviews the findings. The product does not diagnose equipment faults or replace a certified energy audit.",
                ],
                [
                  "What data does it use?",
                  "Monthly building consumption, heated area and documented weather data. This local demo uses synthetic consumption and weather. No resident-level data is required.",
                ],
                [
                  "Can I upload real customer data here?",
                  "Use synthetic files in the local demo. A real pilot requires identity configuration, agreements, hosting decisions and expert validation first.",
                ],
                [
                  "How can we contact the founder?",
                  "Founder contact details have not been supplied. No contact form or email delivery is active in this demo.",
                ],
              ].map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </section>
          </main>
          <footer>
            {brand.name} · Provisional brand, clearance pending · Independent
            product proposal
          </footer>
        </>
      ) : (
        <div className="app-shell">
          <aside>
            <a className="brand" href="#" onClick={() => setPage("home")}>
              <img src="/symbol.svg" alt="" />
              {brand.name}
            </a>
            <p className="workspace-label">DEMO WORKSPACE</p>
            <strong className="org">
              {data?.organization.name ?? "Loading portfolio"}
            </strong>
            <nav aria-label="Application">
              {nav.map(([id, label, Icon]) => (
                <button
                  key={id}
                  className={
                    page === id || (id === "portfolio" && page === "building")
                      ? "active"
                      : ""
                  }
                  onClick={() => {
                    setPage(id);
                    setError("");
                  }}
                >
                  <Icon size={18} />
                  {label}
                  {id === "tasks" && !!data?.tasks.length && (
                    <span className="count">{data.tasks.length}</span>
                  )}
                </button>
              ))}
            </nav>
            <div className="sidebar-foot">
              <p>
                Monthly data.
                <br />
                Explainable investigation.
              </p>
              <small>
                Method {data?.method ?? "loading"}
                <br />
                Provisional brand
              </small>
              <button
                className="text-button"
                onClick={() =>
                  void run(async () => {
                    await api("/reset", { method: "POST" });
                    await load();
                    setToast("Your isolated demo session has been reset.");
                  })
                }
              >
                <RotateCcw size={14} /> Reset my demo
              </button>
            </div>
          </aside>
          <main className="app-main">
            {page === "portfolio" && (
              <>
                <Title
                  eyebrow="YOUR PORTFOLIO"
                  title="A clearer view of where to start"
                  subtitle="Review monthly heat use against each building’s own weather reference."
                >
                  <Downloads />
                </Title>
                <div className="filter-bar">
                  <label>
                    From
                    <input
                      type="date"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </label>
                  <label>
                    To
                    <input
                      type="date"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                    />
                  </label>
                  <button className="secondary" onClick={() => void run(load)}>
                    Apply period
                  </button>
                  <label>
                    Building type
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="">All types</option>
                      {[...new Set(buildings.map((b) => b.building_type))].map(
                        (t) => (
                          <option key={t}>{t}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Data quality
                    <select
                      value={quality}
                      onChange={(e) => setQuality(e.target.value)}
                    >
                      <option value="">All quality</option>
                      <option>usable</option>
                      <option>review required</option>
                    </select>
                  </label>
                  <label>
                    Review status
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="">All statuses</option>
                      {[
                        "investigate",
                        "within reference",
                        "insufficient data",
                        "data review",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <section className="metrics" aria-label="Portfolio summary">
                  {[
                    [
                      filtered.length,
                      "Buildings in view",
                      "Filtered portfolio",
                    ],
                    [
                      filtered.filter((b) => b.model).length,
                      "With usable reference",
                      "18+ training months required",
                    ],
                    [
                      filtered.filter((b) => b.quality !== "usable").length,
                      "Data reviews needed",
                      "Quality and coverage issues",
                    ],
                    [
                      filtered.filter((b) => b.status === "investigate").length,
                      "Investigation priorities",
                      "Human review required",
                    ],
                  ].map(([n, l, caption], i) => (
                    <article key={l} className={i === 3 ? "highlight" : ""}>
                      <p>{l}</p>
                      <strong>{n}</strong>
                      <small>{caption}</small>
                    </article>
                  ))}
                </section>
                <section className="overview-grid">
                  <div className="panel">
                    <div className="section-head">
                      <div>
                        <p className="eyebrow">CONSUMPTION IN VIEW</p>
                        <h2>
                          {fmt(total / 1000, 1)}{" "}
                          <span className="muted">MWh</span>
                        </h2>
                      </div>
                      <span className="small muted">Observed monthly heat</span>
                    </div>
                    <div className="chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={aggregate}>
                          <CartesianGrid vertical={false} stroke="#e4ebee" />
                          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                          <YAxis
                            width={60}
                            tickFormatter={(n) => `${n / 1000}k`}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip
                            formatter={(v) => [
                              fmt(Number(v)) + " kWh",
                              "Observed",
                            ]}
                          />
                          <Area
                            isAnimationActive={false}
                            dataKey="heat"
                            stroke={brand.teal}
                            fill="#d8efeb"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="small muted">
                      kWh, {start} to {end}. Totals reflect available records;
                      coverage varies.
                    </p>
                    <details>
                      <summary>Accessible consumption table</summary>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Month</th>
                              <th>Observed kWh</th>
                            </tr>
                          </thead>
                          <tbody>
                            {aggregate.map((r) => (
                              <tr key={r.period}>
                                <td>{r.period}</td>
                                <td>{fmt(r.heat)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </div>
                  <div className="panel review-note">
                    <FileCheck2 size={30} />
                    <p className="eyebrow">THE NEXT DECISION</p>
                    <h2>Start with the evidence.</h2>
                    <p>
                      The list ranks investigation priority. Weather, missing
                      records and meter changes affect what a comparison can
                      tell you.
                    </p>
                    <div>
                      <span className="small muted">Reference</span>
                      <strong>Each building’s own history</strong>
                    </div>
                    <div>
                      <span className="small muted">Pilot calibration</span>
                      <strong>
                        {((data?.organization.threshold ?? 0.2) * 100).toFixed(
                          0,
                        )}
                        % + 3,000 kWh + persistence
                      </strong>
                    </div>
                  </div>
                </section>
                <section className="panel">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">INVESTIGATION QUEUE</p>
                      <h2>Buildings to review</h2>
                    </div>
                    <span className="small muted">
                      {filtered.length} buildings · {start} – {end}
                    </span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Building</th>
                          <th>Review status</th>
                          <th>Observed kWh</th>
                          <th>Deviation</th>
                          <th>Quality</th>
                          <th>Priority / 100</th>
                          <th>
                            <span className="sr-only">Open</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((b) => (
                          <tr key={b.id}>
                            <td>
                              <button
                                className="link building-link"
                                onClick={() => openBuilding(b.id)}
                              >
                                {b.name}
                                <small>
                                  {b.id} · {fmt(b.heated_area_m2)} m²
                                </small>
                              </button>
                            </td>
                            <td>
                              <Status value={b.status} />
                            </td>
                            <td className="numeric">{fmt(b.observed_kwh)}</td>
                            <td className="numeric">{pct(b.deviation)}</td>
                            <td>
                              {b.quality}
                              <small>
                                {b.missing_months} missing evaluation months
                              </small>
                            </td>
                            <td className="numeric">{b.priority || "—"}</td>
                            <td>
                              <button
                                aria-label={`Open ${b.name}`}
                                className="icon-button"
                                onClick={() => openBuilding(b.id)}
                              >
                                <ArrowUpRight size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!filtered.length && (
                    <p className="empty">
                      No buildings match these filters. Try a wider selection.
                    </p>
                  )}
                </section>
              </>
            )}
            {page === "building" && current && (
              <>
                <button className="back" onClick={() => setPage("portfolio")}>
                  <ChevronLeft size={16} /> Portfolio
                </button>
                <Title
                  eyebrow={`${current.id} / BUILDING DETAIL`}
                  title={current.name}
                  subtitle={`${current.building_type} · ${fmt(current.heated_area_m2)} m² heated area · ${start} to ${end}`}
                >
                  <button onClick={() => newTask(current.id)}>
                    <ClipboardList size={16} /> Create review task
                  </button>
                  <a
                    className="button secondary"
                    href={report("pdf", current.id)}
                    download
                  >
                    <Download size={16} /> Building PDF
                  </a>
                </Title>
                <Status value={current.status} />
                <section className="metrics detail-metrics">
                  {[
                    [fmt(current.observed_kwh), "Observed kWh"],
                    [fmt(current.expected_kwh), "Reference kWh"],
                    [pct(current.deviation), "Observed deviation"],
                    [current.quality, "Data quality"],
                  ].map(([v, l]) => (
                    <article key={l}>
                      <p>{l}</p>
                      <strong>{v}</strong>
                    </article>
                  ))}
                </section>
                <div className="panel">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">MONTHLY HEAT CONSUMPTION / kWh</p>
                      <h2>History and weather reference</h2>
                    </div>
                    <span className="chart-legend">
                      ● Observed <span>┄ Reference</span>
                    </span>
                  </div>
                  <p className="small muted">
                    Training{" "}
                    {current.model
                      ? `${current.model.training_start} to ${current.model.training_end}`
                      : "insufficient"}{" "}
                    · Evaluation {start} to {end}. Reference drawn across
                    history for context; only evaluation months score findings.
                  </p>
                  <div className="chart large">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={current.trace}>
                        <CartesianGrid vertical={false} stroke="#e4ebee" />
                        <XAxis
                          dataKey="period_start"
                          tickFormatter={(s) => s.slice(0, 7)}
                          minTickGap={48}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          tickFormatter={(v) => `${v / 1000}k`}
                          width={60}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip formatter={(v) => fmt(Number(v)) + " kWh"} />
                        <Area
                          isAnimationActive={false}
                          name="Observed"
                          dataKey="heat_kwh"
                          fill="#d8efeb"
                          stroke={brand.teal}
                          strokeWidth={2}
                        />
                        <Line
                          isAnimationActive={false}
                          name="Reference"
                          dataKey="expected_kwh"
                          dot={false}
                          stroke={brand.navy}
                          strokeDasharray="5 5"
                          strokeWidth={2}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <details>
                    <summary>
                      Accessible data table: consumption, weather and coverage
                    </summary>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Period</th>
                            <th>Observed kWh</th>
                            <th>Reference kWh</th>
                            <th>HDD 15.5°C</th>
                            <th>Coverage</th>
                            <th>Use</th>
                          </tr>
                        </thead>
                        <tbody>
                          {current.trace.map((t) => (
                            <tr key={t.period_start}>
                              <td>{t.period_start}</td>
                              <td>{fmt(t.heat_kwh)}</td>
                              <td>{fmt(t.expected_kwh)}</td>
                              <td>{t.hdd}</td>
                              <td>{t.coverage * 100}%</td>
                              <td>
                                {t.evaluation
                                  ? "Evaluation"
                                  : "Training/context"}
                                {t.flagged ? " · Flagged" : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>
                <section className="two">
                  <article className="panel">
                    <p className="eyebrow">WHY FLAGGED?</p>
                    <h2>Trace the comparison</h2>
                    <p>{current.reason}</p>
                    <p>
                      Flagged months:{" "}
                      {current.flagged_months.join(", ") || "None"}
                    </p>
                    <p>
                      Priority = positive period deviation × 100 + 5 × flagged
                      months, capped at 100. The threshold is a pilot
                      calibration assumption.
                    </p>
                    {current.model && (
                      <p className="code">
                        Expected kWh = {fmt(current.model.base_kwh_day, 2)} ×
                        days + {fmt(current.model.heating_kwh_hdd, 2)} × HDD
                      </p>
                    )}
                    <p>
                      Data quality is a completeness/review label. No
                      statistical confidence interval or fault probability is
                      claimed.
                    </p>
                  </article>
                  <article className="panel">
                    <p className="eyebrow">INVESTIGATE</p>
                    <h2>What to check next</h2>
                    <ol>
                      <li>Verify invoice periods, units and meter records.</li>
                      <li>
                        Check occupancy, heated area and hot water inclusion.
                      </li>
                      <li>
                        Review maintenance and control changes with an expert.
                      </li>
                      <li>Record the decision and follow-up evidence.</li>
                    </ol>
                    <h3>Data limitations</h3>
                    <ul>
                      {[...current.quality_issues, ...current.limitations].map(
                        (l, i) => (
                          <li key={i}>{l}</li>
                        ),
                      )}
                    </ul>
                    <button
                      className="secondary"
                      onClick={() => newTask(current.id)}
                    >
                      Create a review task <ArrowRight size={16} />
                    </button>
                  </article>
                </section>
              </>
            )}
            {page === "import" && (
              <>
                <Title
                  eyebrow="DATA WORKSPACE"
                  title="Bring the monthly evidence"
                  subtitle="Use synthetic files in this local demo. Uploads are processed by the backend; raw files are not retained."
                >
                  <a
                    className="button secondary"
                    href="/api/template.csv"
                    download
                  >
                    <Download size={16} /> Download CSV template
                  </a>
                  <a
                    className="button secondary"
                    href="/api/template.xlsx"
                    download
                  >
                    <Download size={16} /> XLSX template
                  </a>
                </Title>
                <div className="steps">
                  <span>01 Select file</span>
                  <span>02 Map & validate</span>
                  <span>03 Review & confirm</span>
                </div>
                <section className="panel">
                  <h2>Select a data file</h2>
                  <p>
                    CSV (UTF-8, comma or semicolon) or macro-free XLSX. Maximum
                    2 MB and 10,000 rows. ISO dates and full calendar months
                    required.
                  </p>
                  <label className="file-drop">
                    <Upload size={30} />
                    <strong>Choose your consumption file</strong>
                    <input
                      aria-label="Consumption file"
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] ?? null);
                        setPreview(null);
                        setMapping({});
                      }}
                    />
                    <span>{file?.name ?? "No file selected"}</span>
                  </label>
                  <button
                    disabled={!file || busy}
                    onClick={() => void run(previewFile)}
                  >
                    Preview & validate <ArrowRight size={16} />
                  </button>
                </section>
                {preview && (
                  <>
                    <section className="panel">
                      <h2>Column mapping</h2>
                      <p>
                        Match source headers to the required data fields, then
                        validate again.
                      </p>
                      <div className="mapping">
                        {preview.headers.map((h) => (
                          <label key={h}>
                            {h}
                            <select
                              value={mapping[h] ?? h}
                              onChange={(e) =>
                                setMapping({ ...mapping, [h]: e.target.value })
                              }
                            >
                              {[
                                ...new Set([
                                  h,
                                  "building_external_id",
                                  "period_start",
                                  "period_end",
                                  "heat_consumption",
                                  "heat_unit",
                                  "heated_area_m2",
                                  "measurement_type",
                                  "includes_dhw",
                                  "source_reference",
                                ]),
                              ].map((f) => (
                                <option key={f}>{f}</option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                      <button
                        className="secondary"
                        onClick={() => void run(previewFile)}
                      >
                        Revalidate mapping
                      </button>
                    </section>
                    <section className="panel">
                      <h2>Validation result</h2>
                      <p>
                        {preview.total_rows} source rows ·{" "}
                        {preview.issues.length} errors ·{" "}
                        {preview.conflicts.length} existing building/month
                        records
                      </p>
                      {preview.issues.length > 0 && (
                        <div className="notice warning">
                          <strong>
                            Import blocked. Correct all errors and upload again.
                          </strong>
                          <ul>
                            {preview.issues.slice(0, 60).map((x, i) => (
                              <li key={i}>
                                Row {x.row} / {x.building}: {x.message}
                              </li>
                            ))}
                          </ul>
                          {preview.issues.length > 60 && (
                            <p>
                              Showing first 60 errors. Total:{" "}
                              {preview.issues.length}.
                            </p>
                          )}
                        </div>
                      )}
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              {Object.keys(preview.preview[0] ?? {}).map(
                                (h) => (
                                  <th key={h}>{h}</th>
                                ),
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {preview.preview.map((r, i) => (
                              <tr key={i}>
                                {Object.values(r).map((v, j) => (
                                  <td key={j}>{String(v ?? "")}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <label>
                        Existing records policy
                        <select
                          value={policy}
                          onChange={(e) => setPolicy(e.target.value)}
                        >
                          <option value="reject">
                            Reject import if any existing record is found
                          </option>
                          <option value="skip">
                            Explicitly skip existing building/month records
                          </option>
                        </select>
                      </label>
                      {preview.conflicts.length > 0 && (
                        <details>
                          <summary>View existing records</summary>
                          <p>{preview.conflicts.slice(0, 50).join("; ")}</p>
                        </details>
                      )}
                      <button
                        disabled={
                          !!preview.issues.length ||
                          busy ||
                          (!!preview.conflicts.length && policy === "reject")
                        }
                        onClick={() =>
                          void run(async () => {
                            const result = await api<{
                              written: number;
                              skipped: number;
                            }>(
                              `/imports/${preview.id}/commit`,
                              json("POST", { policy }),
                            );
                            await load();
                            setToast(
                              `Import complete: ${result.written} records written, ${result.skipped} explicitly skipped.`,
                            );
                            setPreview(null);
                            setPage("portfolio");
                          })
                        }
                      >
                        Confirm import & analyze
                      </button>
                      <p className="small muted">
                        New buildings need validated weather/location matching
                        before a real pilot model is meaningful.
                      </p>
                    </section>
                  </>
                )}
              </>
            )}
            {page === "tasks" && (
              <>
                <Title
                  eyebrow="FINDINGS & FOLLOW-UP"
                  title="Make the next step explicit"
                  subtitle="Review decisions and technical actions remain separate. Demo assignees are fictional roles."
                >
                  <button
                    onClick={() => newTask(buildings[0]?.id ?? "SYN-001")}
                  >
                    New review task
                  </button>
                </Title>
                {task && (
                  <form
                    className="panel form-grid"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        const { id, history, ...body } = task;
                        await api(
                          id ? `/tasks/${id}` : "/tasks",
                          json(id ? "PUT" : "POST", body),
                        );
                        await load();
                        setTask(null);
                        setToast("Review task saved with status history.");
                      });
                    }}
                  >
                    <h2 className="full">
                      {task.id ? "Update review" : "Create review task"}
                    </h2>
                    <label>
                      Building
                      <select
                        value={task.building_id}
                        disabled={!!task.id}
                        onChange={(e) =>
                          setTask({ ...task, building_id: e.target.value })
                        }
                      >
                        {buildings.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} / {b.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Status
                      <select
                        value={task.status}
                        onChange={(e) =>
                          setTask({ ...task, status: e.target.value })
                        }
                      >
                        {[
                          "new",
                          "reviewing",
                          "action planned",
                          "monitoring",
                          "closed",
                        ].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Assigned role
                      <input
                        required
                        maxLength={100}
                        value={task.assignee}
                        onChange={(e) =>
                          setTask({ ...task, assignee: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Due date
                      <input
                        type="date"
                        value={task.due ?? ""}
                        onChange={(e) =>
                          setTask({ ...task, due: e.target.value || null })
                        }
                      />
                    </label>
                    <label>
                      Priority
                      <select
                        value={task.priority}
                        onChange={(e) =>
                          setTask({ ...task, priority: e.target.value })
                        }
                      >
                        {["low", "medium", "high"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label className="full">
                      Technical action
                      <textarea
                        required
                        value={task.technical_action}
                        maxLength={2000}
                        onChange={(e) =>
                          setTask({ ...task, technical_action: e.target.value })
                        }
                      />
                    </label>
                    <label className="full">
                      User assessment / note
                      <textarea
                        value={task.note}
                        maxLength={2000}
                        onChange={(e) =>
                          setTask({ ...task, note: e.target.value })
                        }
                      />
                    </label>
                    <div className="actions full">
                      <button disabled={busy} type="submit">
                        Save review task
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setTask(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                <section className="task-list">
                  {data?.tasks.map((t) => (
                    <article className="panel" key={t.id}>
                      <div className="section-head">
                        <div>
                          <p className="eyebrow">
                            {t.building_id} / {t.priority} PRIORITY
                          </p>
                          <h2>{t.technical_action}</h2>
                        </div>
                        <button
                          className="secondary"
                          onClick={() => setTask(t)}
                        >
                          Update task
                        </button>
                      </div>
                      <Status value={t.status} />
                      <p>
                        Assigned: {t.assignee} · Due: {t.due ?? "Unscheduled"}
                      </p>
                      <p>
                        Assessment: {t.note || "No assessment recorded yet."}
                      </p>
                      <details>
                        <summary>Status history ({t.history.length})</summary>
                        {t.history.map((h, i) => (
                          <p key={i}>
                            {h.at} · {h.status} · {h.note}
                          </p>
                        ))}
                      </details>
                    </article>
                  ))}
                  {!data?.tasks.length && (
                    <div className="panel empty">
                      <ClipboardList size={36} />
                      <h2>No reviews assigned yet</h2>
                      <p>
                        Open a building to turn its finding into a review task.
                      </p>
                      <button
                        className="secondary"
                        onClick={() => setPage("portfolio")}
                      >
                        View buildings
                      </button>
                    </div>
                  )}
                </section>
              </>
            )}
            {page === "monitoring" && (
              <>
                <Title
                  eyebrow="INTERVENTION LOG"
                  title="Track what changed"
                  subtitle="Compare observed use with the weather reference. Changes are descriptive and do not establish causality."
                />
                {data?.interventions.map((i) => {
                  const b = buildings.find((b) => b.id === i.building_id);
                  const post =
                    b?.trace.filter(
                      (t) => t.period_start > i.end && t.evaluation,
                    ) ?? [];
                  const before =
                    b?.trace.filter(
                      (t) => t.period_start < i.start && t.evaluation,
                    ) ?? [];
                  const normalized = (ts: Trace[]) => {
                    const expected = ts.reduce(
                      (s, t) => s + (t.expected_kwh ?? 0),
                      0,
                    );
                    return expected >= 100
                      ? ts.reduce((s, t) => s + t.heat_kwh, 0) / expected - 1
                      : null;
                  };
                  return (
                    <article className="panel" key={i.id}>
                      <div className="section-head">
                        <div>
                          <p className="eyebrow">
                            {i.building_id} / {i.start} – {i.end}
                          </p>
                          <h2>{i.kind}</h2>
                        </div>
                        <button
                          className="secondary"
                          onClick={() => openBuilding(i.building_id)}
                        >
                          View history <ArrowUpRight size={16} />
                        </button>
                      </div>
                      <p>{i.scope}</p>
                      <p>Expected effect: {i.expected_effect}</p>
                      <p className="small muted">
                        Monthly kWh before and after the event month. Observed
                        use (teal) and weather reference (dashed navy).
                        Synthetic HDD base 15.5°C.
                      </p>
                      <div className="chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={b?.trace.filter((t) => t.evaluation) ?? []}
                          >
                            <CartesianGrid vertical={false} stroke="#e4ebee" />
                            <XAxis
                              dataKey="period_start"
                              tickFormatter={(s) => s.slice(0, 7)}
                              tick={{ fontSize: 11 }}
                            />
                            <YAxis
                              width={60}
                              tickFormatter={(n) => `${n / 1000}k`}
                              tick={{ fontSize: 11 }}
                            />
                            <Tooltip
                              formatter={(v) => fmt(Number(v)) + " kWh"}
                            />
                            <Area
                              isAnimationActive={false}
                              name="Observed"
                              dataKey="heat_kwh"
                              stroke={brand.teal}
                              fill="#d8efeb"
                            />
                            <Line
                              isAnimationActive={false}
                              name="Weather reference"
                              dataKey="expected_kwh"
                              stroke={brand.navy}
                              strokeDasharray="5 5"
                              dot={false}
                            />
                            <ReferenceLine
                              x={i.start.slice(0, 7) + "-01"}
                              stroke="#80520b"
                              label={{ value: "Event month", fontSize: 11 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      <details>
                        <summary>
                          Accessible before/after and weather table
                        </summary>
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Month</th>
                                <th>Observed kWh</th>
                                <th>Reference kWh</th>
                                <th>HDD</th>
                                <th>Coverage</th>
                                <th>Relation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {b?.trace
                                .filter((t) => t.evaluation)
                                .map((t) => (
                                  <tr key={t.period_start}>
                                    <td>{t.period_start}</td>
                                    <td>{fmt(t.heat_kwh)}</td>
                                    <td>{fmt(t.expected_kwh)}</td>
                                    <td>{t.hdd}</td>
                                    <td>{t.coverage * 100}%</td>
                                    <td>
                                      {t.period_start > i.end
                                        ? "After"
                                        : t.period_start < i.start
                                          ? "Before"
                                          : "Event month"}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                      <div className="two">
                        <p>
                          Before: {before.length} evaluation months
                          <br />
                          <strong>{pct(normalized(before))}</strong> vs weather
                          reference
                        </p>
                        <p>
                          After: {post.length} full evaluation months
                          <br />
                          <strong>
                            {post.length < 3 || !b?.model
                              ? "Not enough post-intervention data"
                              : pct(normalized(post)) + " vs weather reference"}
                          </strong>
                        </p>
                      </div>
                      <p className="small muted">
                        {post.length >= 3
                          ? "Descriptive observation only. Check usage, meter, tariff and renovation changes before attribution."
                          : "At least three complete post-intervention months and a usable baseline required."}{" "}
                        Synthetic weather coverage:{" "}
                        {post.length
                          ? Math.round(
                              (post.reduce((s, t) => s + t.coverage, 0) /
                                post.length) *
                                100,
                            ) + "%"
                          : "unavailable"}
                        . No validated annual savings.
                      </p>
                      <p className="small">
                        Cost:{" "}
                        {i.cost == null
                          ? "Not supplied"
                          : `€${fmt(i.cost, 2)} / source: ${i.cost_source}`}
                      </p>
                    </article>
                  );
                })}
                <form
                  className="panel form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await api(
                        "/interventions",
                        json("POST", {
                          ...intervention,
                          cost:
                            intervention.cost === ""
                              ? null
                              : Number(intervention.cost),
                        }),
                      );
                      await load();
                      setToast("Intervention recorded.");
                    });
                  }}
                >
                  <h2 className="full">Record an intervention</h2>
                  <label>
                    Building
                    <select
                      value={intervention.building_id}
                      onChange={(e) =>
                        setIntervention({
                          ...intervention,
                          building_id: e.target.value,
                        })
                      }
                    >
                      {buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(
                    [
                      "kind",
                      "start",
                      "end",
                      "scope",
                      "expected_effect",
                      "cost",
                      "cost_source",
                      "notes",
                    ] as const
                  ).map((k) => (
                    <label key={k}>
                      {
                        {
                          kind: "Type",
                          start: "Start date",
                          end: "End date",
                          scope: "Scope",
                          expected_effect: "Expected effect",
                          cost: "Cost EUR (optional)",
                          cost_source: "Cost source",
                          notes: "Confounding changes / notes",
                        }[k]
                      }
                      <input
                        required={[
                          "kind",
                          "start",
                          "end",
                          "scope",
                          "expected_effect",
                        ].includes(k)}
                        type={
                          k === "start" || k === "end"
                            ? "date"
                            : k === "cost"
                              ? "number"
                              : "text"
                        }
                        min={k === "cost" ? 0 : undefined}
                        maxLength={1000}
                        value={intervention[k]}
                        onChange={(e) =>
                          setIntervention({
                            ...intervention,
                            [k]: e.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                  <div className="full">
                    <button disabled={busy}>Save intervention</button>
                  </div>
                </form>
              </>
            )}
            {page === "settings" && (
              <>
                <Title
                  eyebrow="WORKSPACE SETTINGS"
                  title="Keep assumptions visible"
                  subtitle="Critical parameter changes are recorded in the tenant audit trail."
                />
                <form
                  className="panel form-grid"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await api(
                        "/settings",
                        json("PUT", { name: orgName, threshold, unit: "kWh" }),
                      );
                      await load();
                      setToast("Settings saved and change recorded.");
                    });
                  }}
                >
                  <label>
                    Organization name
                    <input
                      value={orgName}
                      maxLength={120}
                      required
                      onChange={(e) => setOrgName(e.target.value)}
                    />
                  </label>
                  <label>
                    Relative deviation threshold
                    <input
                      type="number"
                      step=".05"
                      min=".1"
                      max=".8"
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                    />
                  </label>
                  <p className="full">
                    Energy: kWh. HDD base: 15.5°C (synthetic assumption). The
                    current weather input is fixed; sensitivity testing and real
                    station matching require pilot validation.
                  </p>
                  <div>
                    <button disabled={busy}>Save settings</button>
                  </div>
                </form>
                <section className="panel">
                  <h2>Access and data handling</h2>
                  <p>
                    This local demo isolates tasks and imports by browser
                    session. Sessions expire after eight hours; raw upload bytes
                    are discarded after validation. Reset removes your session
                    workspace.
                  </p>
                  <p>
                    Pilot mode requires a verified external identity and a
                    server-provisioned organization membership. Public
                    deployment, agreements, backups and operational hardening
                    remain pending.
                  </p>
                  <p>
                    English interface. Latvian locale architecture is prepared,
                    with translation review pending.
                  </p>
                  <button
                    className="secondary"
                    onClick={() =>
                      void run(async () =>
                        setAudit(await api<unknown[]>("/audit")),
                      )
                    }
                  >
                    Load audit trail
                  </button>
                  <pre className="audit">
                    {audit.length
                      ? JSON.stringify(audit, null, 2)
                      : "No audit entries loaded."}
                  </pre>
                </section>
              </>
            )}
            <footer>
              {brand.name} · Method {data?.method} · Human review required
            </footer>
          </main>
        </div>
      )}
      {busy && (
        <div className="loading" role="status">
          Processing evidence…
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          <strong>Action could not complete</strong>
          <p>{error}</p>
          <button className="secondary" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
