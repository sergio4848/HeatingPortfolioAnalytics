import { useEffect, useRef, useState } from "react";
import { Sparkles, FileText, ExternalLink, ShieldCheck, X } from "lucide-react";
import { api, json } from "../lib/api";
import { fmt, pct } from "../lib/format";
import type { Building, Preview } from "../types";
import type { DateRange } from "../lib/portfolio";
import "./ai.css";

type AIStatus = {
  model: string;
  server_enabled: boolean;
  provider_configured: boolean;
  organization_enabled: boolean;
  can_configure: boolean;
  data_type: string;
  real_data_authorized: boolean;
  disclosure: string;
};
type Source = {
  id: string;
  title: string;
  kind: string;
  url: string;
  data: Record<string, unknown>;
};
type Metric = { label: string; value: number | null; unit: string };
type Evidence = {
  building_id: string;
  analysis_version: string;
  method: string;
  status: string;
  quality: string;
  metrics: Record<string, Metric>;
  sources: Source[];
};
type AIResponse<T> = {
  id: string;
  feature: string;
  mode: "live_claude" | "safe_fallback";
  created_at: string;
  model: string;
  analysis_version: string;
  content: T | null;
  current: boolean;
  cached?: boolean;
  message?: string;
  evidence?: Evidence;
};
type Point = { text: string; metric_ids: string[]; source_ids: string[] };
type Explanation = {
  observations: Point[];
  possible_explanations: Point[];
  recommended_checks: Point[];
  missing_information: Point[];
  limitations: Point[];
};
type TaskDraft = {
  title: string;
  evidence_summary: string;
  checks: { action: string; question: string }[];
  missing_information: string[];
  suggested_role: string;
  closure_records: string[];
  metric_ids: string[];
  source_ids: string[];
};
type Summary = {
  text: string;
  citations: {
    source_id: string;
    url: string;
    title: string;
    version: string;
    page: number;
    date: string;
    quote: string;
  }[];
}[];
type Mapping = {
  suggestions: {
    source_column: string;
    target_field: string;
    rationale: string;
    uncertainty: string;
    user_check: string;
  }[];
  warnings: string[];
};
type Answer = {
  answer: string;
  metric_ids: string[];
  source_ids: string[];
  building_ids: string[];
  unsupported: boolean;
};
type Document = {
  id: string;
  title: string;
  date: string;
  source: string;
  version: string;
  page_count: number;
};

function useAIStatus() {
  const [status, setStatus] = useState<AIStatus | null>(null);
  useEffect(() => {
    let active = true;
    api<AIStatus>("/ai/status")
      .then((s) => {
        if (active) setStatus(s);
      })
      .catch(() => {
        /* Core product remains usable. */
      });
    return () => {
      active = false;
    };
  }, []);
  return status;
}
function Availability({ status }: { status: AIStatus | null }) {
  if (!status)
    return (
      <p className="ai-availability">
        Checking optional Claude availability… Manual workflows remain
        available.
      </p>
    );
  if (!status.server_enabled || !status.provider_configured)
    return (
      <p className="ai-availability">
        Claude is not configured on this backend. Numerical analysis and manual
        workflows remain available.
      </p>
    );
  if (!status.organization_enabled)
    return (
      <p className="ai-availability">
        AI is off for this workspace. An administrator can enable it in{" "}
        <a href="#/settings">Settings</a>.
      </p>
    );
  if (status.data_type !== "synthetic" && !status.real_data_authorized)
    return (
      <p className="ai-availability">
        External processing of real data needs organization authorization in
        Settings.
      </p>
    );
  return (
    <p className="ai-availability ready">
      <ShieldCheck size={16} />
      Claude available / {status.model} / each request needs approval
    </p>
  );
}
const available = (s: AIStatus | null) =>
  !!(
    s?.server_enabled &&
    s.provider_configured &&
    s.organization_enabled &&
    (s.data_type === "synthetic" || s.real_data_authorized)
  );
function Consent({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="ai-consent">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}
function Metadata({
  response,
  current,
}: {
  response: {
    created_at: string;
    model: string;
    analysis_version: string;
    cached?: boolean;
  };
  current: boolean;
}) {
  return (
    <p className="ai-metadata">
      Live Claude response ·{" "}
      {new Date(response.created_at).toLocaleString("en-GB")} · {response.model}
      <br />
      Analysis {response.analysis_version.slice(0, 12)} ·{" "}
      {current ? "Current evidence" : "Stale — regenerate before use"}
      {response.cached ? " · Validated cached result" : ""}
    </p>
  );
}
function Metrics({ ids, evidence }: { ids: string[]; evidence: Evidence }) {
  return (
    <dl className="ai-metrics">
      {ids.map((id) => {
        const m = evidence.metrics[id];
        return m ? (
          <div key={id}>
            <dt>{m.label}</dt>
            <dd>
              {m.value === null
                ? "Unavailable"
                : m.unit === "ratio"
                  ? pct(m.value)
                  : fmt(m.value, 1)}{" "}
              {m.unit === "ratio" || m.value === null ? "" : m.unit}
            </dd>
          </div>
        ) : null;
      })}
    </dl>
  );
}
function SourceLinks({
  ids,
  evidence,
  onOpen,
}: {
  ids: string[];
  evidence: Evidence;
  onOpen: (source: Source) => void;
}) {
  return (
    <div className="ai-source-links">
      {ids.map((id) => {
        const source = evidence.sources.find((s) => s.id === id);
        return source ? (
          <button
            type="button"
            className="link"
            key={id}
            onClick={() => onOpen(source)}
          >
            <FileText size={13} />
            {source.title}
            <ExternalLink size={12} />
          </button>
        ) : null;
      })}
    </div>
  );
}
function SourceDialog({
  source,
  onClose,
}: {
  source: Source;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      className="source-dialog"
      aria-labelledby="source-dialog-title"
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      data-lenis-prevent
    >
      <div className="section-head">
        <div>
          <p className="eyebrow">AUTHORIZED SOURCE / {source.kind}</p>
          <h2 id="source-dialog-title">{source.title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close source"
          onClick={() => ref.current?.close()}
        >
          <X size={20} />
        </button>
      </div>
      <dl className="source-record">
        {Object.entries(source.data).map(([key, value]) => (
          <div key={key}>
            <dt>{key.replaceAll("_", " ")}</dt>
            <dd>
              {typeof value === "object" ? (
                <pre>{JSON.stringify(value, null, 2)}</pre>
              ) : (
                String(value ?? "Unavailable")
              )}
            </dd>
          </div>
        ))}
      </dl>
    </dialog>
  );
}

export function AIColumnMapping({
  preview,
  onApply,
}: {
  preview: Preview;
  onApply: (mapping: Record<string, string>) => void;
}) {
  const status = useAIStatus();
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [result, setResult] = useState<AIResponse<Mapping> | null>(null),
    [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    setResult(null);
    setSelected([]);
    setConsent(false);
  }, [preview.id]);
  async function suggest() {
    setBusy(true);
    setError("");
    try {
      setResult(
        await api<AIResponse<Mapping>>(
          "/ai/mapping",
          json("POST", {
            batch_id: preview.id,
            approved_data_transfer: consent,
          }),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ai-box">
      <p className="eyebrow">
        <Sparkles size={14} /> OPTIONAL CLAUDE / COLUMN MAPPING
      </p>
      <h3>Suggested column mapping</h3>
      <Availability status={status} />
      <p>
        Headers and up to three sample rows are sent only after approval. Values
        are bounded; the complete file stays on this backend. File content is
        treated as untrusted data.
      </p>
      <Consent checked={consent} onChange={setConsent}>
        I approve sending these headers and limited sample cells to Anthropic
        for this suggestion.
      </Consent>
      <button
        type="button"
        className="secondary"
        disabled={!consent || !available(status) || busy}
        onClick={() => void suggest()}
      >
        {busy ? "Requesting suggestions…" : "Suggest column mapping"}
      </button>
      {error && (
        <p role="alert" className="ai-error">
          {error}
        </p>
      )}
      {result?.mode === "safe_fallback" && (
        <p role="status">
          {result.message} Continue with manual mapping above.
        </p>
      )}
      {result?.content && (
        <>
          <Metadata response={result} current={true} />
          <div className="ai-mapping-suggestions">
            {result.content.suggestions.map((item) => (
              <label key={item.source_column} className="ai-consent">
                <input
                  type="checkbox"
                  disabled={item.target_field === "unmapped"}
                  checked={selected.includes(item.source_column)}
                  onChange={(e) =>
                    setSelected((previous) =>
                      e.target.checked
                        ? [...previous, item.source_column]
                        : previous.filter((x) => x !== item.source_column),
                    )
                  }
                />
                <span>
                  <strong>
                    {item.source_column} → {item.target_field}
                  </strong>
                  <small>
                    {item.uncertainty}. {item.rationale}
                  </small>
                  <small>Check: {item.user_check}</small>
                </span>
              </label>
            ))}
          </div>
          {result.content.warnings.map((warning, i) => (
            <p key={i} className="ai-warning">
              {warning}
            </p>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={!selected.length}
            onClick={() =>
              onApply(
                Object.fromEntries(
                  result
                    .content!.suggestions.filter((x) =>
                      selected.includes(x.source_column),
                    )
                    .map((x) => [x.source_column, x.target_field]),
                ),
              )
            }
          >
            Apply selected suggestions to mapping
          </button>
          <p className="small muted">
            This does not import data. Revalidate the mapping, resolve every
            error and explicitly confirm the import.
          </p>
        </>
      )}
    </section>
  );
}

function Documents({
  bid,
  revision,
  onChange,
}: {
  bid: string;
  revision: number;
  onChange: () => void;
}) {
  const [documents, setDocuments] = useState<Document[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [deleteId, setDeleteId] = useState("");
  const [mode, setMode] = useState("note"),
    [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    date: "",
    source: "",
    version: "1",
    text: "",
  });
  useEffect(() => {
    api<Document[]>(`/ai/buildings/${encodeURIComponent(bid)}/documents`)
      .then(setDocuments)
      .catch((e) => setError(e.message));
  }, [bid, revision]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "pdf") {
        if (!file) throw new Error("Choose a text PDF.");
        const data = new FormData();
        data.append("file", file);
        data.append("title", form.title);
        data.append("recorded_date", form.date);
        data.append("source_name", form.source);
        data.append("version", form.version);
        await api(`/ai/buildings/${encodeURIComponent(bid)}/documents/pdf`, {
          method: "POST",
          body: data,
        });
      } else
        await api(
          `/ai/buildings/${encodeURIComponent(bid)}/documents/notes`,
          json("POST", form),
        );
      setForm({ title: "", date: "", source: "", version: "1", text: "" });
      setFile(null);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api(`/ai/documents/${deleteId}`, { method: "DELETE" });
      setDeleteId("");
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="maintenance-documents">
      <summary>Maintenance sources ({documents.length})</summary>
      <p>
        Local, building-scoped notes and text PDFs. Preserve the recorded date,
        source and version. Raw PDF bytes are discarded after extraction. No OCR
        or automatic external transmission.
      </p>
      {documents.length ? (
        <ul className="document-list">
          {documents.map((doc) => (
            <li key={doc.id}>
              <div>
                <strong>{doc.title}</strong>
                <small>
                  {doc.date} · v{doc.version} · {doc.page_count} pages ·{" "}
                  {doc.source}
                </small>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => setDeleteId(doc.id)}
              >
                Remove source
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No maintenance sources added. Missing documentation remains visible in
          AI explanations.
        </p>
      )}
      {deleteId && (
        <div className="ai-warning" role="alert">
          <p>Remove this source and invalidate the related AI cache?</p>
          <div className="actions">
            <button type="button" disabled={busy} onClick={() => void remove()}>
              Confirm source removal
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => setDeleteId("")}
            >
              Keep source
            </button>
          </div>
        </div>
      )}
      <form className="form-grid" onSubmit={(event) => void save(event)}>
        <h3 className="full">Add a dated source</h3>
        <label>
          Document type
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="note">Text note</option>
            <option value="pdf">Text PDF</option>
          </select>
        </label>
        <label>
          Recorded date
          <input
            required
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>
        <label>
          Source title
          <input
            required
            maxLength={140}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label>
          Source / provenance
          <input
            required
            maxLength={250}
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
          />
        </label>
        <label>
          Source version
          <input
            required
            maxLength={30}
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
          />
        </label>
        {mode === "note" ? (
          <label className="full">
            Maintenance note
            <textarea
              required
              minLength={10}
              maxLength={40000}
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
            />
          </label>
        ) : (
          <label className="full">
            Text PDF file
            <input
              key={revision}
              required
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <small>
              Maximum 2 MB, thirty pages and forty thousand extracted
              characters. Scans without text are rejected.
            </small>
          </label>
        )}
        <div className="full">
          <button disabled={busy}>
            {busy ? "Saving source…" : "Save source locally"}
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="ai-error">
          {error}
        </p>
      )}
    </details>
  );
}

export function AIWorkbench({
  building,
  range,
  onTaskSaved,
}: {
  building: Building;
  range: DateRange;
  onTaskSaved: () => Promise<void>;
}) {
  const status = useAIStatus(),
    bid = building.id;
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [evidence, setEvidence] = useState<Evidence | null>(null),
    [revision, setRevision] = useState(0),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const [explanation, setExplanation] =
      useState<AIResponse<Explanation> | null>(null),
    [draft, setDraft] = useState<AIResponse<TaskDraft> | null>(null),
    [summary, setSummary] = useState<AIResponse<Summary> | null>(null),
    [source, setSource] = useState<Source | null>(null);
  const [edit, setEdit] = useState({
      title: "",
      technical_action: "",
      assignee: "",
      note: "",
    }),
    [approve, setApprove] = useState(false);
  useEffect(() => {
    let active = true;
    setEvidence(null);
    api<Evidence>(
      `/ai/buildings/${encodeURIComponent(bid)}/evidence?${new URLSearchParams(range)}`,
    )
      .then((p) => {
        if (active) setEvidence(p);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [building, bid, range.start, range.end, revision]);
  useEffect(() => {
    setExplanation(null);
    setDraft(null);
    setSummary(null);
    setConsent(false);
    setApprove(false);
  }, [bid, range.start, range.end]);
  async function request(
    feature: "explanation" | "task-draft" | "maintenance-summary",
  ) {
    setBusy(feature);
    setError("");
    try {
      const body = {
        ...range,
        approved_data_transfer: consent,
        ...(feature === "maintenance-summary"
          ? { question: "What maintenance was recorded before this increase?" }
          : {}),
      };
      const endpoint = `/ai/buildings/${encodeURIComponent(bid)}/${feature}`;
      if (feature === "explanation")
        setExplanation(
          await api<AIResponse<Explanation>>(endpoint, json("POST", body)),
        );
      if (feature === "maintenance-summary")
        setSummary(
          await api<AIResponse<Summary>>(endpoint, json("POST", body)),
        );
      if (feature === "task-draft") {
        const result = await api<AIResponse<TaskDraft>>(
          endpoint,
          json("POST", body),
        );
        setDraft(result);
        setApprove(false);
        if (result.content)
          setEdit({
            title: result.content.title,
            assignee: result.content.suggested_role,
            technical_action: result.content.checks
              .map((x) => x.action + " — " + x.question)
              .join("\n"),
            note: result.content.evidence_summary,
          });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function saveTask(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setBusy("approve");
    setError("");
    try {
      await api(
        `/ai/drafts/${draft.id}/approve`,
        json("POST", {
          ...edit,
          analysis_version: draft.analysis_version,
          confirmed: approve,
          priority: "medium",
        }),
      );
      await onTaskSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const isCurrent = (result: {
    analysis_version: string;
    created_at: string;
  }) =>
    !!evidence &&
    result.analysis_version === evidence.analysis_version &&
    clock - Date.parse(result.created_at) < 3600000;
  return (
    <section className="panel ai-workbench" aria-labelledby="building-ai-title">
      <p className="eyebrow">
        <Sparkles size={15} /> EVIDENCE AND OPTIONAL CLAUDE
      </p>
      <h2 id="building-ai-title">Explain, verify, then decide.</h2>
      <p>
        Engine metrics and authorized sources remain the record. Claude can
        propose explanations and editable task drafts; it cannot diagnose faults
        or save a task on its own.
      </p>
      <Availability status={status} />
      {evidence ? (
        <p className="ai-metadata">
          Verified evidence / {evidence.method} / {range.start} to {range.end} /
          version {evidence.analysis_version.slice(0, 12)} / {evidence.quality}
        </p>
      ) : (
        <p role="status">Loading verified evidence…</p>
      )}
      <Documents
        bid={bid}
        revision={revision}
        onChange={() => setRevision((n) => n + 1)}
      />
      <Consent checked={consent} onChange={setConsent}>
        I approve sending this building’s displayed analysis metrics and bounded
        maintenance excerpts to Anthropic for the selected request.{" "}
        {status?.data_type === "synthetic"
          ? "This workspace contains synthetic data."
          : "I have permission to process these records externally."}
      </Consent>
      <div className="actions ai-actions">
        {(
          [
            ["explanation", "Explain this finding"],
            ["maintenance-summary", "Summarize recorded maintenance"],
            ["task-draft", "Draft investigation task"],
          ] as const
        ).map(([feature, label]) => (
          <button
            className="secondary"
            type="button"
            key={feature}
            disabled={!consent || !available(status) || !evidence || !!busy}
            onClick={() => void request(feature)}
          >
            {busy === feature ? "Requesting Claude…" : label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="ai-error">
          {error}
        </p>
      )}
      {[explanation, summary, draft].map((result, i) =>
        result?.mode === "safe_fallback" ? (
          <p role="status" className="ai-warning" key={i}>
            {result.message} No unverified AI text is displayed.
          </p>
        ) : null,
      )}
      {explanation?.content && evidence && (
        <article
          className={"ai-result " + (!isCurrent(explanation) ? "stale" : "")}
        >
          <h3>Evidence-backed explanation</h3>
          <Metadata response={explanation} current={isCurrent(explanation)} />
          {Object.entries(explanation.content).map(([name, points]) => (
            <section key={name}>
              <h4>
                {name.replaceAll("_", " ")}
                {name === "possible_explanations"
                  ? " / hypotheses, not diagnoses"
                  : ""}
              </h4>
              {points.length ? (
                points.map((point: Point, i: number) => (
                  <div className="ai-point" key={i}>
                    <p>{point.text}</p>
                    <Metrics ids={point.metric_ids} evidence={evidence} />
                    <SourceLinks
                      ids={point.source_ids}
                      evidence={evidence}
                      onOpen={setSource}
                    />
                  </div>
                ))
              ) : (
                <p>No additional evidence provided.</p>
              )}
            </section>
          ))}
        </article>
      )}
      {summary?.content && evidence && (
        <article className="ai-result">
          <h3>Recorded maintenance before this finding</h3>
          <Metadata response={summary} current={isCurrent(summary)} />
          {summary.content.map((block, i) => (
            <div className="ai-point" key={i}>
              <p>{block.text}</p>
              {block.citations.map((citation, j) => (
                <blockquote key={j}>
                  <p>{citation.quote}</p>
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      const entry = evidence.sources.find(
                        (x) => x.id === citation.source_id,
                      );
                      if (entry) setSource(entry);
                    }}
                  >
                    {citation.title} / {citation.date} / page {citation.page} /
                    v{citation.version}
                  </button>
                </blockquote>
              ))}
            </div>
          ))}
          <p className="ai-warning">
            Recorded timing does not establish causality. Human review required.
          </p>
        </article>
      )}
      {draft?.content && evidence && (
        <article className="ai-result">
          <h3>Review the investigation task draft</h3>
          <Metadata response={draft} current={isCurrent(draft)} />
          <Metrics ids={draft.content.metric_ids} evidence={evidence} />
          <SourceLinks
            ids={draft.content.source_ids}
            evidence={evidence}
            onOpen={setSource}
          />
          <p>
            <strong>Missing information:</strong>{" "}
            {draft.content.missing_information.join("; ") ||
              "No additional items supplied."}
          </p>
          <p>
            <strong>Closure records:</strong>{" "}
            {draft.content.closure_records.join("; ")}
          </p>
          <form
            className="form-grid"
            onSubmit={(event) => void saveTask(event)}
          >
            <label className="full">
              Draft task title
              <input
                required
                maxLength={160}
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </label>
            <label>
              Suggested responsible role
              <input
                required
                maxLength={100}
                value={edit.assignee}
                onChange={(e) => setEdit({ ...edit, assignee: e.target.value })}
              />
            </label>
            <label className="full">
              Draft checks and questions
              <textarea
                required
                maxLength={2000}
                value={edit.technical_action}
                onChange={(e) =>
                  setEdit({ ...edit, technical_action: e.target.value })
                }
              />
            </label>
            <label className="full">
              Draft evidence summary
              <textarea
                maxLength={2000}
                value={edit.note}
                onChange={(e) => setEdit({ ...edit, note: e.target.value })}
              />
            </label>
            <div className="full">
              <Consent checked={approve} onChange={setApprove}>
                I have reviewed and edited this draft and explicitly approve
                creating this investigation task.
              </Consent>
              <button disabled={!approve || !isCurrent(draft) || !!busy}>
                {busy === "approve"
                  ? "Saving approved task…"
                  : "Approve and save task"}
              </button>
            </div>
          </form>
        </article>
      )}
      {source && (
        <SourceDialog source={source} onClose={() => setSource(null)} />
      )}
      <p className="small muted">
        No confidence percentage, definitive diagnosis or guaranteed saving is
        produced. Sources and analysis changes invalidate earlier responses. API
        unavailability never replaces the numerical engine.
      </p>
    </section>
  );
}

export function AISettingsPanel() {
  const initial = useAIStatus();
  const [enabled, setEnabled] = useState(false),
    [real, setReal] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [usage, setUsage] = useState<
    | {
        at: string;
        feature: string;
        model: string;
        input_tokens: number;
        output_tokens: number;
        validation: string;
        estimated_cost_usd: number | null;
        error: string | null;
      }[]
    | null
  >(null);
  useEffect(() => {
    if (initial) {
      setEnabled(initial.organization_enabled);
      setReal(initial.real_data_authorized);
    }
  }, [initial]);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await api(
        "/ai/settings",
        json("PUT", { enabled, real_data_authorized: real }),
      );
      setMessage(
        "AI workspace preferences saved. Every external request still needs approval.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel ai-settings">
      <p className="eyebrow">
        <ShieldCheck size={15} /> ORGANIZATION AI CONTROLS
      </p>
      <h2>Optional Claude processing</h2>
      <p>
        Claude receives approved analysis metrics, bounded source excerpts or up
        to three import sample rows. The API key stays on the backend. Real
        records require an appropriate data-processing basis and organization
        permission.
      </p>
      <p className="ai-availability">
        Backend:{" "}
        {initial?.server_enabled && initial.provider_configured
          ? "Configured"
          : "Not configured"}{" "}
        / Model: {initial?.model ?? "Loading"}
      </p>
      <Consent checked={enabled} onChange={setEnabled}>
        Enable AI requests for this organization
      </Consent>
      {initial?.data_type !== "synthetic" && (
        <Consent checked={real} onChange={setReal}>
          I confirm this organization has permission to send the selected real
          data to Anthropic.
        </Consent>
      )}
      <button
        disabled={busy || !initial?.can_configure}
        onClick={() => void save()}
      >
        Save AI preferences
      </button>
      {message && <p role="status">{message}</p>}
      <p className="small muted">
        Daily request, token and estimated-cost budgets are enforced by the
        backend per organization. Estimates are not provider invoices.
      </p>
      <button
        className="secondary"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          api<typeof usage>("/ai/usage")
            .then(setUsage)
            .catch((e) => setMessage(e.message))
            .finally(() => setBusy(false));
        }}
      >
        Load AI usage
      </button>
      {usage !== null && (
        <div className="table-wrap">
          <table>
            <caption>
              Recent AI requests — token-based cost estimates, not invoices
            </caption>
            <thead>
              <tr>
                <th>Time</th>
                <th>Feature</th>
                <th>Tokens in / out</th>
                <th>Estimate USD</th>
                <th>Validation</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((row, i) => (
                <tr key={i}>
                  <td>{new Date(row.at).toLocaleString("en-GB")}</td>
                  <td>{row.feature.replaceAll("_", " ")}</td>
                  <td>
                    {row.input_tokens} / {row.output_tokens}
                  </td>
                  <td>
                    {row.estimated_cost_usd === null
                      ? "Unavailable"
                      : row.estimated_cost_usd.toFixed(6)}
                  </td>
                  <td>
                    {row.validation}
                    {row.error ? " / " + row.error : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!usage.length && <p>No AI requests recorded.</p>}
        </div>
      )}
    </section>
  );
}

export function PortfolioAssistant({ range }: { range: DateRange }) {
  const status = useAIStatus();
  const [question, setQuestion] = useState(
      "Which buildings have persistent deviations?",
    ),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<AIResponse<Answer> | null>(null),
    [source, setSource] = useState<Source | null>(null);
  async function ask(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setResult(
        await api<AIResponse<Answer>>(
          "/ai/assistant",
          json("POST", { ...range, question, approved_data_transfer: consent }),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel ai-assistant">
      <p className="eyebrow">
        <Sparkles size={15} /> READ-ONLY PORTFOLIO ASSISTANT
      </p>
      <h2>Ask about the available evidence.</h2>
      <p>
        Tools can list buildings/findings, read building evidence/interventions
        and search authorized maintenance sources. There is no SQL, shell,
        browser, device control, external messaging or task-creation tool. Tool
        calls, context and time are bounded.
      </p>
      <Availability status={status} />
      <p className="small muted">
        Analysis period: {range.start} to {range.end}. Building lists are
        limited; narrow the question when more matches exist.
      </p>
      <form onSubmit={(event) => void ask(event)}>
        <label>
          Portfolio question
          <textarea
            required
            minLength={3}
            maxLength={600}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <Consent checked={consent} onChange={setConsent}>
          I approve sending this question and the necessary bounded portfolio
          evidence to Anthropic for this request.
        </Consent>
        <button disabled={!consent || !available(status) || busy}>
          {busy ? "Querying permitted tools…" : "Ask portfolio assistant"}
        </button>
      </form>
      {error && (
        <p role="alert" className="ai-error">
          {error}
        </p>
      )}
      {result?.mode === "safe_fallback" && (
        <p role="status" className="ai-warning">
          {result.message}
        </p>
      )}
      {result?.content && result.evidence && (
        <article className="ai-result">
          <Metadata response={result} current={result.current} />
          <p>{result.content.answer}</p>
          <p>
            {result.content.unsupported
              ? "This question is outside the supported evidence."
              : "Read-only application tools supplied the evidence below."}
          </p>
          <Metrics ids={result.content.metric_ids} evidence={result.evidence} />
          <SourceLinks
            ids={result.content.source_ids}
            evidence={result.evidence}
            onOpen={setSource}
          />
        </article>
      )}
      {source && (
        <SourceDialog source={source} onClose={() => setSource(null)} />
      )}
    </section>
  );
}
