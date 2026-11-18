import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS, VERDICT } from "@/lib/labels.ts";
import { SEGMENTS, type Confidence, type Status } from "@/lib/ladder.ts";
import type { Citation } from "@/lib/cite.ts";

export const REPO_URL = "https://github.com/AdityaS5/carbon-credit-portal";

export function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <rect width="30" height="30" rx="8" fill="#17573F" />
      <path d="M8 21c5-1 8-5 8.5-12 1 6 3.5 9.5 5.5 10.5" stroke="#FFFFFF" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="16.5" cy="9" r="2" fill="#F2B84B" />
    </svg>
  );
}

const STEPS = ["Your project", "A few questions", "Your routes"];

export function Header({ step }: { step?: 1 | 2 | 3 }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="brand"><Logo /><b>Carbon Route Finder</b><span className="tag">India · demo</span></Link>
        {step ? (
          <ol className="stepper" aria-label="Progress">
            {STEPS.map((s, i) => {
              const n = i + 1, cls = n < step ? "done" : n === step ? "on" : "";
              return (
                <li key={s} className={cls} aria-current={n === step ? "step" : undefined}>
                  {i > 0 && <span className="sep" aria-hidden="true">—</span>}
                  <span className="dot">{n < step ? "✓" : n}</span>{s}
                </li>
              );
            })}
          </ol>
        ) : (
          <nav className="nav" aria-label="Main">
            <Link href="/#how">How it works</Link>
            <Link href="/#coverage">Coverage</Link>
            <Link href="/sources/">Sources</Link>
            <a href={REPO_URL}>GitHub ↗</a>
          </nav>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <span>Demo portfolio project · screening only, not investment, legal or certification advice</span>
        <span>No AI decides any verdict · your answers stay in this browser tab</span>
      </div>
    </footer>
  );
}

export function Page({ step, children }: { step?: 1 | 2 | 3; children: ReactNode }) {
  return (<><Header step={step} /><main><div className="wrap">{children}</div></main><Footer /></>);
}

export function VerdictBadge({ v, small }: { v: string; small?: boolean }) {
  const icon = v === "eligible" ? "✓" : v === "needs_info" ? "?" : "–";
  return <span className={`badge ${v}${small ? " sm" : ""}`}><span aria-hidden="true">{icon}</span>{VERDICT[v] ?? v}</span>;
}

export function Tag({ s }: { s: Status | string }) {
  return <span className={`tag ${s}`}>{STATUS[s] ?? s}</span>;
}

export function Meter({ c }: { c: Confidence | null }) {
  const n = c ? SEGMENTS[c] : 0;
  return (
    <span className="meter">
      <span className="segs" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <span key={i} className={`seg${i < n ? " on" : ""}`} />)}</span>
      <span>{c ? c.charAt(0).toUpperCase() + c.slice(1) : "—"}<span className="sr"> confidence</span></span>
    </span>
  );
}

export function Cite({ c }: { c: Citation }) {
  const text = <span className="mono tiny">{c.label}{c.verify ? " (verify)" : ""}</span>;
  return c.href
    ? <a href={c.href} target="_blank" rel="noreferrer" title={c.publisherPage ? `Publisher page: ${c.publisherPage}` : undefined}>{text} ↗</a>
    : text;
}
