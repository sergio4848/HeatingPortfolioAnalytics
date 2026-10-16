import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  Menu,
  Check,
  Database,
  Thermometer,
  FileCheck2,
  ClipboardList,
} from "lucide-react";
import type { Building } from "../types";
import { Status } from "../components/status";
import { pct } from "../lib/format";
import brand from "../../../../packages/brand/brand.json";
import "./landing.css";

const story = [
  {
    title: "Prepare the data.",
    text: "Validate monthly records before they enter the analysis.",
    detail:
      "CSV and macro-free XLSX. Explicit mapping, units and duplicate policy.",
    image: "import",
    action: "Open imports",
    page: "import",
  },
  {
    title: "Understand the finding.",
    text: "Trace observed consumption against the building’s own weather reference.",
    detail:
      "Time-separated training, visible quality checks and source records.",
    image: "finding",
    action: "Open building evidence",
    page: "building",
  },
  {
    title: "Plan the investigation.",
    text: "Turn a reviewed finding into a task with clear checks and responsibility.",
    detail:
      "Claude can draft. A person reviews, edits and explicitly approves the task.",
    image: "tasks",
    action: "Open review tasks",
    page: "tasks",
  },
  {
    title: "Track what changed.",
    text: "Keep interventions and follow-up evidence beside the consumption history.",
    detail:
      "Before/after observations are descriptive. Timing does not establish causality.",
    image: "interventions",
    action: "Open interventions",
    page: "monitoring",
  },
] as const;

type Props = {
  buildings: Building[];
  busy: boolean;
  onDemo: () => void;
  onOpen: (id: string) => void;
  onPage: (page: "import" | "tasks" | "monitoring") => void;
};
export default function Landing({
  buildings,
  busy,
  onDemo,
  onOpen,
  onPage,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const gallery = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let disposed = false;
    import("./landing-motion")
      .then(({ mountLandingMotion }) => {
        if (!disposed && root.current)
          cleanup = mountLandingMotion(root.current);
      })
      .catch(() => {
        /* Motion is optional; static content stays visible. */
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
  function move(next: number) {
    const element = gallery.current;
    if (!element) return;
    const target = Math.max(0, Math.min(story.length - 1, next));
    const card = element.children[target] as HTMLElement;
    element.scrollTo({
      left: card.offsetLeft - (element.children[0] as HTMLElement).offsetLeft,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  function closeMenu() {
    if (menu.current) menu.current.open = false;
  }
  const links = (
    <>
      <a href="#product" onClick={closeMenu}>
        Product
      </a>
      <a href="#how-it-works" onClick={closeMenu}>
        How it works
      </a>
      <a href="#pilot" onClick={closeMenu}>
        Pilot
      </a>
      <button
        disabled={busy || !buildings.length}
        onClick={() => {
          closeMenu();
          onDemo();
        }}
      >
        Demo <ArrowUpRight size={15} />
      </button>
    </>
  );
  return (
    <div className="product-site" ref={root}>
      <header className="site-header">
        <a className="site-brand" href="#/">
          <img src="/symbol.svg" width="30" height="30" alt="" />
          {brand.name}
          <span>PROVISIONAL</span>
        </a>
        <nav className="desktop-site-nav" aria-label="Product navigation">
          {links}
        </nav>
        <details
          className="site-menu"
          ref={menu}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              closeMenu();
              (
                event.currentTarget.querySelector("summary") as HTMLElement
              )?.focus();
            }
          }}
        >
          <summary>
            <Menu size={20} /> Menu
          </summary>
          <nav aria-label="Mobile product navigation">{links}</nav>
        </details>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className="site-hero site-container">
          <div className="hero-copy">
            <p className="site-kicker">HEATING PORTFOLIO ANALYTICS / LATVIA</p>
            <h1>
              <span className="hero-line">Know which</span>
              <span className="hero-line">buildings need</span>
              <span className="hero-line accent">attention.</span>
            </h1>
            <p className="hero-description">
              Turn heat-consumption records into clear investigation priorities
              for your building portfolio.
            </p>
            <div className="site-actions">
              <button disabled={busy || !buildings.length} onClick={onDemo}>
                Explore the demo <ArrowRight size={17} />
              </button>
              <a className="site-text-link" href="#pilot">
                See the pilot plan <ArrowUpRight size={17} />
              </a>
            </div>
            <p className="site-footnote">
              Existing monthly data. Human review. No new sensors required.
            </p>
          </div>
          <div className="hero-surface">
            <div className="hero-product-bar">
              <span>PORTFOLIO / INVESTIGATION ORDER</span>
              <span className="synthetic-label">Synthetic demo</span>
            </div>
            <div className="hero-product-summary">
              <strong>{buildings.length || "—"}</strong>
              <span>
                buildings in the
                <br />
                current demonstration
              </span>
              <FileCheck2 size={32} />
            </div>
            <h2>
              A clearer starting point
              <br />
              for the next review.
            </h2>
            <div className="hero-building-list">
              {buildings.slice(0, 3).map((building) => (
                <button key={building.id} onClick={() => onOpen(building.id)}>
                  <span>
                    <strong>{building.name}</strong>
                    <small>
                      {building.id} / {pct(building.deviation)} vs reference
                    </small>
                  </span>
                  <Status value={building.status} />
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
            <p className="site-footnote">
              Calculated by the application’s numerical engine.
              <br />
              Synthetic records are not measured customer results.
            </p>
          </div>
        </section>
        <section className="problem-section site-container" id="how-it-works">
          <p className="site-kicker">THE DAILY QUESTIONS</p>
          <div className="problem-composition">
            <h2>
              More records.
              <br />A clearer order
              <br />
              of investigation.
            </h2>
            <div className="problem-questions">
              {[
                [Database, "Which building should we review first?"],
                [Thermometer, "Is the increase explained by colder weather?"],
                [FileCheck2, "Can we trust the available records?"],
                [ClipboardList, "What changed after maintenance?"],
              ].map(([Icon, text], i) => {
                const Symbol = Icon as typeof Database;
                return (
                  <p key={i}>
                    <Symbol size={21} />
                    <span>{String(text)}</span>
                    <span className="question-index">0{i + 1}</span>
                  </p>
                );
              })}
            </div>
          </div>
        </section>
        <section
          className="product-showcase"
          id="product"
          aria-labelledby="showcase-title"
        >
          <div className="site-container showcase-heading">
            <div>
              <p className="site-kicker">FROM SOURCE RECORD TO FOLLOW-UP</p>
              <h2 id="showcase-title">One reviewable workflow.</h2>
            </div>
            <div className="showcase-controls">
              <button
                className="secondary"
                aria-label="Previous product view"
                disabled={index === 0}
                onClick={() => move(index - 1)}
              >
                <ArrowLeft size={19} />
              </button>
              <span aria-live="polite">
                {index + 1} / {story.length}
              </span>
              <button
                className="secondary"
                aria-label="Next product view"
                disabled={index === story.length - 1}
                onClick={() => move(index + 1)}
              >
                <ArrowRight size={19} />
              </button>
            </div>
          </div>
          <p className="site-container showcase-instruction">
            Use the arrows, arrow keys or drag the desktop gallery. All four
            views are listed vertically on small screens and with reduced
            motion.
          </p>
          <div
            className="showcase-scroll"
            ref={gallery}
            role="region"
            aria-label="Product workflow gallery"
            tabIndex={0}
            data-lenis-prevent
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                move(
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? story.length - 1
                      : index + (event.key === "ArrowRight" ? 1 : -1),
                );
              }
            }}
            onScroll={() => {
              const el = gallery.current;
              if (el && el.children.length) {
                const width =
                  (el.children[1] as HTMLElement).offsetLeft -
                  (el.children[0] as HTMLElement).offsetLeft;
                setIndex(
                  Math.min(3, Math.max(0, Math.round(el.scrollLeft / width))),
                );
              }
            }}
          >
            {story.map((item, i) => (
              <article className="showcase-slide" key={item.image}>
                <div className="showcase-caption">
                  <span className="site-kicker">
                    0{i + 1} / SYNTHETIC DEMO DATA
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
                <div className="showcase-frame">
                  <img
                    src={`/showcase/${item.image}.webp`}
                    width="1440"
                    height="1000"
                    loading="lazy"
                    decoding="async"
                    alt={`Actual Portotherm synthetic demo: ${item.title}`}
                  />
                </div>
                <div className="showcase-bottom">
                  <p>{item.detail}</p>
                  <button
                    className="site-inline-button"
                    onClick={() =>
                      item.page === "building"
                        ? onOpen("SYN-003")
                        : onPage(item.page)
                    }
                  >
                    {item.action} <ArrowUpRight size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section
          className="site-ai site-container"
          aria-labelledby="ai-workflow-title"
        >
          <div className="site-ai-intro">
            <p className="site-kicker">OPTIONAL CLAUDE WORKFLOWS</p>
            <h2 id="ai-workflow-title">
              The engine calculates.
              <br />
              Claude helps explain.
              <br />
              You decide.
            </h2>
            <p>
              Claude receives only the evidence or limited sample data you
              approve. The numerical model remains the source of every
              consumption and deviation metric.
            </p>
            <p className="site-footnote">
              Backend API configuration and organization opt-in are required. No
              simulated AI response is presented as live.
            </p>
          </div>
          <ol className="ai-workflow-list">
            <li>
              <span>01</span>
              <div>
                <h3>Suggested column mapping</h3>
                <p>
                  Review each source column, proposed field and uncertainty.
                  Validate the mapping before importing.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Evidence-backed explanations</h3>
                <p>
                  Separate observations from possible explanations. Inspect
                  versioned metrics and authorized maintenance sources.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Investigation task drafts</h3>
                <p>
                  Edit checks, responsibility and closure evidence. A task is
                  saved only after your explicit approval.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className="site-pilot" id="pilot">
          <div className="site-container pilot-composition">
            <div>
              <p className="site-kicker">PROPOSED PILOT / DISCUSSION SCOPE</p>
              <h2>
                5–10 buildings.
                <br />
                Six weeks of
                <br />
                retrospective review.
              </h2>
            </div>
            <div>
              <p>
                For professional apartment management companies in Latvia. This
                is a proposed scope, not an announced customer engagement.
              </p>
              <ul>
                <li>
                  <Check size={18} />
                  Check authorized monthly data and weather provenance.
                </li>
                <li>
                  <Check size={18} />
                  Review findings with a local energy specialist.
                </li>
                <li>
                  <Check size={18} />
                  Assess usefulness, missing evidence and follow-up decisions.
                </li>
              </ul>
              <p>
                Longer observation and an independent verification method are
                needed before any annual savings claim.
              </p>
              <button
                className="secondary"
                onClick={() => onPage("monitoring")}
              >
                View demo interventions <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </section>
        <section className="site-trust site-container">
          <p className="site-kicker">TRUST AND LIMITS</p>
          <h2>
            Keep the evidence.
            <br />
            Keep the uncertainty visible.
          </h2>
          <div className="trust-columns">
            <p>
              Work with existing records.
              <br />
              Review data quality.
              <br />
              Open source references.
            </p>
            <p>
              Human review remains essential.
              <br />
              No definitive fault diagnosis.
              <br />
              No guaranteed savings.
            </p>
          </div>
        </section>
        <section className="site-final site-container">
          <h2>
            See the workflow
            <br />
            before planning a pilot.
          </h2>
          <div className="site-actions">
            <button disabled={busy || !buildings.length} onClick={onDemo}>
              Open the working demo <ArrowRight size={17} />
            </button>
            <a href="#pilot" className="site-text-link">
              Review the pilot scope <ArrowUpRight size={17} />
            </a>
          </div>
          <p className="site-footnote">
            No contact form is connected. Founder contact details and real-data
            agreements remain pilot preparation items.
          </p>
        </section>
      </main>
      <footer className="site-container site-footer">
        <span>
          {brand.name} / {brand.tagline}
        </span>
        <span>
          Provisional brand. Synthetic demonstration. Independent product
          proposal.
        </span>
      </footer>
    </div>
  );
}
