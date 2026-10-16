import "@fontsource-variable/inter";
import { BuildingTable } from "./components/building-table";
import { ResetDialog } from "./components/reset-dialog";
import { ErrorBoundary } from "./components/error-boundary";
import { AuditTrail, type AuditEntry } from "./components/audit-trail";
import { useRoute } from "./hooks/use-route";
import {
  DEFAULT_RANGE,
  reportUrl,
  matchesBuilding,
  monthlyTotals,
  rangeLabel,
  type DateRange,
} from "./lib/portfolio";
import { api, json, ApiError } from "./lib/api";
import { fmt, pct } from "./lib/format";
import { Status } from "./components/status";
import { Title } from "./components/page-header";
import type { Portfolio, Task, Preview, Trace } from "./types";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  LayoutDashboard,
  Upload,
  ClipboardList,
  Settings,
  Activity,
  Download,
  ChevronLeft,
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
  Layers,
} from "lucide-react";
import brand from "../../../packages/brand/brand.json";
import "./tokens.css";
import {
  AIColumnMapping,
  AIWorkbench,
  AISettingsPanel,
  PortfolioAssistant,
} from "./features/ai";
import "./style.css";
import "./theme.css";

const Landing = lazy(() => import("./features/landing"));
const PortfolioChart = lazy(() =>
  import("./features/charts").then((m) => ({ default: m.PortfolioChart })),
);
const HeatChart = lazy(() =>
  import("./features/charts").then((m) => ({ default: m.HeatChart })),
);
function App() {
  const { page, selected, go: setPage } = useRoute();
  const [appliedRange, setAppliedRange] = useState<DateRange>(DEFAULT_RANGE);
  const [query, setQuery] = useState("");
  const loadSequence = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<Portfolio | null>(null),
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
  const [mappingDirty, setMappingDirty] = useState(false);
  const [task, setTask] = useState<Task | null>(null),
    [audit, setAudit] = useState<AuditEntry[] | null>(null);
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
  async function load(range: DateRange = appliedRange) {
    const sequence = ++loadSequence.current;
    const d = await api<Portfolio>(`/portfolio?${new URLSearchParams(range)}`);
    if (sequence !== loadSequence.current) return;
    setAppliedRange(range);
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
  async function resetDemo() {
    await api("/reset", { method: "POST" });
    await load();
    setTask(null);
    setPreview(null);
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setMapping({});
    setMappingDirty(false);
    setAudit(null);
    setToast("Your isolated demo session has been reset.");
  }
  useEffect(() => {
    void run(async () => {
      try {
        await api("/session");
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
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
        (!status || b.status === status) &&
        matchesBuilding(b, query),
    );
  const current = buildings.find((b) => b.id === selected);
  const report = (format: "csv" | "pdf", bid = "") =>
    reportUrl(
      format,
      appliedRange,
      { kind: type, quality, status, q: query },
      bid,
    );
  const total = filtered.reduce((sum, b) => sum + b.observed_kwh, 0);
  const aggregate = monthlyTotals(filtered);
  const priorityBuilding = buildings.find((b) => b.status === "investigate");
  const period = rangeLabel(appliedRange);
  const clearFilters = () => {
    setQuery("");
    setType("");
    setQuality("");
    setStatus("");
  };
  const nav = [
    ["portfolio", "Portfolio", LayoutDashboard],
    ["import", "Import data", Upload],
    ["tasks", "Review tasks", ClipboardList],
    ["monitoring", "Interventions", Activity],
    ["settings", "Settings", Settings],
  ] as const;
  function openBuilding(id: string) {
    setPage("building", id);
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
    setMappingDirty(false);
  }
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
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <div className="disclosure" role="banner">
        <span className="demo-dot" />{" "}
        {data?.disclosure ??
          "Synthetic demo data — not measured customer results"}
        <span className="disclosure-right">LOCAL DEMO · MONTHLY ANALYSIS</span>
      </div>
      {page === "home" ? (
        <Suspense
          fallback={
            <main id="main-content" tabIndex={-1}>
              Loading product…
            </main>
          }
        >
          <Landing
            buildings={buildings}
            busy={busy}
            onDemo={() => setPage("portfolio")}
            onOpen={openBuilding}
            onPage={setPage}
          />
        </Suspense>
      ) : (
        <div className="app-shell">
          <aside>
            <a className="brand" href="#/" onClick={() => setPage("home")}>
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
                  aria-current={
                    page === id || (id === "portfolio" && page === "building")
                      ? "page"
                      : undefined
                  }
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
              <ResetDialog onReset={resetDemo} />
            </div>
          </aside>
          <main className="app-main" id="main-content" tabIndex={-1}>
            <div className="workspace-toolbar">
              <div>
                <Layers size={15} />
                <span>Workspace</span>
                <span className="breadcrumb-divider">/</span>
                <strong>
                  {page === "building"
                    ? (current?.name ?? "Building")
                    : (nav.find(([id]) => id === page)?.[1] ??
                      (
                        {
                          buildings: "Buildings",
                          findings: "Findings",
                          reports: "Reports",
                          assistant: "Assistant",
                        } as Record<string, string>
                      )[page])}
                </strong>
              </div>
              <details className="workspace-views">
                <summary>Workspace views</summary>
                <nav aria-label="Additional workspace views">
                  {(
                    [
                      ["buildings", "Buildings"],
                      ["findings", "Findings"],
                      ["reports", "Reports"],
                      ["assistant", "Assistant"],
                    ] as const
                  ).map(([id, label]) => (
                    <a
                      key={id}
                      href={`#/${id}`}
                      aria-current={page === id ? "page" : undefined}
                      onClick={(event) => {
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                        setPage(id);
                      }}
                    >
                      {label}
                    </a>
                  ))}
                </nav>
              </details>
              <span className="workspace-state">
                <ShieldCheck size={14} /> Isolated synthetic workspace
              </span>
            </div>
            {page === "buildings" && (
              <>
                <Title
                  eyebrow="PORTFOLIO INVENTORY"
                  title="Buildings"
                  subtitle="Inspect the buildings behind the analysis. Missing evidence remains visible."
                >
                  <button onClick={() => setPage("import")}>Import data</button>
                </Title>
                <p className="period-badge">{period}</p>
                <BuildingTable
                  items={buildings.filter((b) => matchesBuilding(b, query))}
                  query={query}
                  onQuery={setQuery}
                  onClear={clearFilters}
                  period={period}
                  onOpen={openBuilding}
                />
              </>
            )}
            {page === "findings" && (
              <>
                <Title
                  eyebrow="ANALYSIS EVIDENCE"
                  title="Findings"
                  subtitle="Investigation priorities and data limitations are separate signals."
                >
                  <button onClick={() => setPage("portfolio")}>
                    Change analysis period
                  </button>
                </Title>
                <p className="period-badge">{period}</p>
                {buildings
                  .filter((b) => b.status !== "within reference")
                  .map((b) => (
                    <section className="panel" key={b.id}>
                      <Status value={b.status} />
                      <h2>{b.name}</h2>
                      <p>{b.reason}</p>
                      <p>
                        Observed {fmt(b.observed_kwh)} kWh · Expected{" "}
                        {b.expected_kwh === null
                          ? "Insufficient data"
                          : fmt(b.expected_kwh) + " kWh"}{" "}
                        · Deviation {pct(b.deviation)}
                      </p>
                      <button onClick={() => openBuilding(b.id)}>
                        Open finding evidence
                      </button>
                    </section>
                  ))}
                {!buildings.some((b) => b.status !== "within reference") && (
                  <p>
                    No findings available. Import and validate monthly data
                    first.
                  </p>
                )}
              </>
            )}
            {page === "reports" && (
              <>
                <Title
                  eyebrow="EXPORT VERIFIED ANALYSIS"
                  title="Reports"
                  subtitle="Exports use the applied portfolio period and filters."
                >
                  <Downloads />
                </Title>
                <section className="panel">
                  <h2>Current report scope</h2>
                  <p>
                    {period} · {filtered.length} buildings
                  </p>
                  <p>
                    Type: {type || "All"} / Data quality: {quality || "All"} /
                    Status: {status || "All"} / Search: {query || "None"}
                  </p>
                  <button
                    className="secondary"
                    onClick={() => setPage("portfolio")}
                  >
                    Review filters and analysis period
                  </button>
                </section>
                <BuildingTable
                  items={filtered}
                  query={query}
                  onQuery={setQuery}
                  onClear={clearFilters}
                  period={period}
                  onOpen={openBuilding}
                />
              </>
            )}
            {page === "assistant" && (
              <>
                <Title
                  eyebrow="OPTIONAL CLAUDE"
                  title="Portfolio assistant"
                  subtitle="Questions are answered through bounded, authorized application tools."
                />
                <PortfolioAssistant range={appliedRange} />
              </>
            )}
            {page === "portfolio" && (
              <>
                <Title
                  eyebrow="YOUR PORTFOLIO"
                  title="Portfolio overview"
                  subtitle="A monthly view of your portfolio, with the context to decide what comes next."
                >
                  <Downloads />
                </Title>
                <div className="view-context">
                  <span className="period-badge">{period}</span>
                  <span>{buildings.length} synthetic buildings</span>
                  <span className="context-separator">·</span>
                  <span>{data?.method}</span>
                </div>
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
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void run(() => load({ start, end }))}
                  >
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
                {(start !== appliedRange.start || end !== appliedRange.end) && (
                  <p className="period-pending" role="status">
                    Period changes are not applied yet. Apply the period to
                    update the view and reports.
                  </p>
                )}
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
                      <Suspense fallback={<div className="chart-skeleton" />}>
                        <PortfolioChart data={aggregate} />
                      </Suspense>
                    </div>
                    <p className="small muted">
                      kWh, {appliedRange.start} to {appliedRange.end}. Totals
                      reflect available records; coverage varies.
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
                    <h2>
                      {priorityBuilding
                        ? "An investigation worth starting."
                        : "The evidence comes first."}
                    </h2>
                    <p>
                      The list ranks investigation priority. Weather, missing
                      records and meter changes affect what a comparison can
                      tell you.
                    </p>
                    {priorityBuilding && (
                      <button
                        className="priority-preview"
                        onClick={() => openBuilding(priorityBuilding.id)}
                      >
                        <span>
                          <strong>{priorityBuilding.name}</strong>
                          <small>
                            {pct(priorityBuilding.deviation)} vs weather
                            reference
                          </small>
                        </span>
                        <ArrowUpRight size={20} />
                      </button>
                    )}
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
                <BuildingTable
                  items={filtered}
                  query={query}
                  onQuery={setQuery}
                  onOpen={openBuilding}
                  onClear={clearFilters}
                  period={period}
                />
              </>
            )}
            {page === "building" && !current && !busy && data && (
              <section className="panel empty">
                <h1>Building unavailable</h1>
                <p>This building is not in your current workspace.</p>
                <button onClick={() => setPage("portfolio")}>
                  Back to portfolio
                </button>
              </section>
            )}
            {page === "building" && current && (
              <>
                <button className="back" onClick={() => setPage("portfolio")}>
                  <ChevronLeft size={16} /> Portfolio
                </button>
                <Title
                  eyebrow={`${current.id} / BUILDING DETAIL`}
                  title={current.name}
                  subtitle={`${current.building_type} · ${fmt(current.heated_area_m2)} m² heated area · ${appliedRange.start} to ${appliedRange.end}`}
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
                    · Evaluation {appliedRange.start} to {appliedRange.end}.
                    Reference drawn across history for context; only evaluation
                    months score findings.
                  </p>
                  <div className="chart large">
                    <Suspense fallback={<div className="chart-skeleton" />}>
                      <HeatChart
                        rows={current.trace}
                        evaluationStart={appliedRange.start}
                      />
                    </Suspense>
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
            {page === "building" && current && (
              <AIWorkbench
                key={current.id}
                building={current}
                range={appliedRange}
                onTaskSaved={async () => {
                  await load();
                  setPage("tasks");
                  setToast("Approved investigation task saved.");
                }}
              />
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
                      ref={fileInput}
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] ?? null);
                        setPreview(null);
                        setMapping({});
                        setMappingDirty(false);
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
                              onChange={(e) => {
                                setMapping({ ...mapping, [h]: e.target.value });
                                setMappingDirty(true);
                              }}
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
                                  "cost",
                                  "currency",
                                  "__ignore__",
                                ]),
                              ].map((f) => (
                                <option key={f} value={f}>
                                  {f === "__ignore__"
                                    ? "Ignore column (not imported)"
                                    : f}
                                </option>
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
                      {mappingDirty && (
                        <p role="status" className="notice warning">
                          Mapping changed. Revalidate before confirming import.
                        </p>
                      )}
                      <AIColumnMapping
                        preview={preview}
                        onApply={(suggestions) => {
                          setMapping({ ...mapping, ...suggestions });
                          setMappingDirty(true);
                        }}
                      />
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
                          mappingDirty ||
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
                        const { id } = task;
                        const body = {
                          building_id: task.building_id,
                          title: task.title ?? "",
                          status: task.status,
                          assignee: task.assignee,
                          note: task.note,
                          technical_action: task.technical_action,
                          priority: task.priority,
                          due: task.due,
                        };
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
                    <label className="full">
                      Task title (optional)
                      <input
                        maxLength={160}
                        value={task.title ?? ""}
                        onChange={(e) =>
                          setTask({ ...task, title: e.target.value })
                        }
                      />
                    </label>
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
                          <h2>{t.title || t.technical_action}</h2>
                          {t.title && (
                            <p style={{ whiteSpace: "pre-line" }}>
                              {t.technical_action}
                            </p>
                          )}
                        </div>
                        <button
                          className="secondary"
                          onClick={() => setTask(t)}
                        >
                          Update task
                        </button>
                      </div>
                      <Status value={t.status} />
                      {t.ai_draft_id && (
                        <div className="notice">
                          <p>
                            Human-approved Claude draft / analysis{" "}
                            {t.analysis_version?.slice(0, 12)}
                          </p>
                          <p>
                            Closure evidence: {t.closure_records?.join("; ")}
                          </p>
                          <p>Source references: {t.source_ids?.join("; ")}</p>
                          <button
                            className="secondary"
                            onClick={() => openBuilding(t.building_id)}
                          >
                            Review current building evidence
                          </button>
                        </div>
                      )}
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
                  {!task && !data?.tasks.length && (
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
                        <Suspense fallback={<div className="chart-skeleton" />}>
                          <HeatChart
                            rows={b?.trace.filter((t) => t.evaluation) ?? []}
                            eventMonth={i.start.slice(0, 7) + "-01"}
                          />
                        </Suspense>
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
                <AISettingsPanel />
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
                    disabled={busy}
                    onClick={() =>
                      void run(async () =>
                        setAudit(await api<AuditEntry[]>("/audit")),
                      )
                    }
                  >
                    {audit === null
                      ? "Load audit trail"
                      : "Refresh audit trail"}
                  </button>
                  <AuditTrail entries={audit} />
                </section>
                <section className="panel mobile-reset">
                  <h2>Demo workspace</h2>
                  <p>
                    Restore the original synthetic portfolio and remove this
                    session’s imported records, tasks and notes.
                  </p>
                  <ResetDialog onReset={resetDemo} />
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

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
