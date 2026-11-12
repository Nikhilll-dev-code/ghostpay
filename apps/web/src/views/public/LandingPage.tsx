import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Clock,
  Crosshair,
  Flask,
  Hash,
  LockKey,
  Power,
  Receipt,
  Robot,
  Scroll,
  ShieldCheck,
  Prohibit,
} from "../../components/icons";
import type { Icon } from "../../components/icons";
import { FloatingNav, Reveal, SiteFooter, SkipLink } from "./PublicChrome";

const TAGLINE_LINES = ["Ghost proposes the action.", "The Trust Engine decides what runs.", "You keep control of the money."];

export const TaglineReveal: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Set<number>>(new Set());
  const words = TAGLINE_LINES.join(" ").split(" ");

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      setActive(new Set(words.map((_, index) => index)));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        setActive((current) => {
          const next = new Set(current);
          entries.forEach((entry) => {
            if (entry.isIntersecting) next.add(Number((entry.target as HTMLElement).dataset.index));
          });
          return next;
        });
      },
      { rootMargin: "0px 0px -40% 0px", threshold: 0 }
    );
    node.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      <h2 className="heading-3 max-w-hero" aria-label={TAGLINE_LINES.join(" ")}>
        {words.map((word, index) => (
          <React.Fragment key={index}>
            <span data-index={index} aria-hidden="true" className={`word ${active.has(index) ? "is-active" : ""}`}>
              {word}
            </span>{" "}
          </React.Fragment>
        ))}
      </h2>
    </div>
  );
};

const DecisionExample: React.FC = () => (
  <figure className="card pop-enter w-full max-w-md space-y-4 p-6" aria-label="Example Trust Engine decision">
    <figcaption className="flex items-center justify-between gap-2">
      <span className="caption-3 uppercase tracking-wider text-fg-subtle">Example decision</span>
      <span className="badge badge-neutral">Illustrative</span>
    </figcaption>
    <div className="panel space-y-1 p-3">
      <div className="caption-4 text-fg-subtle">Customer request, treated as untrusted text</div>
      <p className="body-6 text-fg">Can I get a 22% discount on the premium bundle priced at $120?</p>
    </div>
    <dl className="grid grid-cols-2 gap-3">
      <div>
        <dt className="caption-4 text-fg-subtle">Proposed action</dt>
        <dd className="body-5 num">DISCOUNT_REQUEST</dd>
      </div>
      <div>
        <dt className="caption-4 text-fg-subtle">Requested discount</dt>
        <dd className="body-5 num">22.00%</dd>
      </div>
      <div>
        <dt className="caption-4 text-fg-subtle">Authority Passport limit</dt>
        <dd className="body-5 num">15.00%</dd>
      </div>
      <div>
        <dt className="caption-4 text-fg-subtle">PayPal call</dt>
        <dd className="body-5">Not made</dd>
      </div>
    </dl>
    <div className="notice notice-bad items-center">
      <Prohibit size={20} className="shrink-0 text-bad" aria-hidden="true" />
      <div className="min-w-0">
        <div className="body-4 text-fg">Blocked</div>
        <div className="caption-5 num text-fg-muted">DISCOUNT_EXCEEDS_LIMIT</div>
      </div>
    </div>
    <p className="caption-5 text-fg-subtle">Based on the seeded demo scenario. Run it yourself in Ghost Brain.</p>
  </figure>
);

const BENEFITS: Array<{ icon: Icon; title: string; body: string }> = [
  {
    icon: ShieldCheck,
    title: "Limits the AI cannot edit",
    body: "Every Authority Passport version is immutable. Only an owner can publish a new one, and the server enforces it.",
  },
  {
    icon: Scroll,
    title: "Evidence on every decision",
    body: "Each decision stores its check results, reason codes and policy version, so you read facts instead of a generated story.",
  },
  {
    icon: Hash,
    title: "Approvals that cannot be replayed",
    body: "An approval is tied to a SHA256 hash of the exact payload. It expires, works once and is checked again at execution.",
  },
  {
    icon: Power,
    title: "One click stops new payments",
    body: "The kill switch lives on the backend. While it is engaged, new and queued executions are rejected.",
  },
  {
    icon: Flask,
    title: "Test before you publish",
    body: "Replay fixtures against a proposed policy in the What-If Lab, then run Ghostbreaker to see which attacks the current policy stops.",
  },
];

const STEPS: Array<{ icon: Icon; title: string; body: string }> = [
  {
    icon: Robot,
    title: "A customer asks",
    body: "Ghost Brain turns the message into a structured proposal with an intent, an amount and a confidence. The message stays a request, never an instruction.",
  },
  {
    icon: ShieldCheck,
    title: "The Trust Engine decides",
    body: "Deterministic code checks the mode, the kill switch, your limits and risk rules. The outcome is allow, require approval, block or frozen.",
  },
  {
    icon: Receipt,
    title: "Sandbox executes and logs",
    body: "Only authorized actions reach PayPal Sandbox. Results are verified or held as pending reconciliation, and each step lands in the audit trail.",
  },
];

const ATTACKS: Array<{ name: string; result: string; code: string }> = [
  { name: "Out of authority discount", result: "Blocked", code: "DISCOUNT_EXCEEDS_LIMIT" },
  { name: "Amount cap breach", result: "Blocked", code: "AMOUNT_EXCEEDS_LIMIT" },
  { name: "Social engineering bypass", result: "Blocked", code: "RISK_REVIEW_REQUIRED" },
  { name: "Refund without a capture", result: "Blocked", code: "PAYMENT_NOT_CAPTURED" },
  { name: "Split transaction exhaustion", result: "Blocked", code: "DAILY_BUDGET_EXCEEDED" },
  { name: "Execution under lockdown", result: "Frozen", code: "GHOST_LOCKDOWN" },
  { name: "Expired approval replay", result: "Blocked", code: "APPROVAL_EXPIRED" },
  { name: "Tampered payload substitution", result: "Blocked", code: "APPROVAL_PAYLOAD_MISMATCH" },
  { name: "Direct prompt injection", result: "Blocked", code: "DISCOUNT_EXCEEDS_LIMIT" },
  { name: "Prohibited money transfer", result: "Blocked", code: "ACTION_NOT_ENABLED" },
];

export const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: "Does Ghost move real money?",
    a: "No. Ghost targets PayPal Sandbox only. Without Sandbox credentials it runs a labeled simulation, and records created that way are marked as simulated.",
  },
  {
    q: "Can the AI change its own limits?",
    a: "No. The AI only returns a structured proposal. Limits change when an owner publishes a new Authority Passport version, and the backend enforces who may do that.",
  },
  {
    q: "What happens when information is missing or unclear?",
    a: "Ghost denies by default. Missing, stale or contradictory inputs lead to a block or a human review, never a silent approval.",
  },
  {
    q: "How do approvals work?",
    a: "An approval is bound to the exact action payload, expires after a short window and can be used once. The backend checks it again at execution time.",
  },
  {
    q: "What if PayPal does not confirm the result?",
    a: "The transaction moves to pending reconciliation. Ghost never assumes success and never retries a money movement blindly.",
  },
  {
    q: "How do I stop Ghost quickly?",
    a: "Use the Freeze Ghost button in the header. New executions are rejected on the server. Requests that PayPal Sandbox already accepted cannot be recalled.",
  },
  {
    q: "Is the demo data real?",
    a: "No. The customers, fixtures and the seeded transaction are synthetic demo data and are labeled that way in the product.",
  },
  {
    q: "How do I try it?",
    a: "Open the control room and sign in with the demo owner account from the README. The five minute tour in the README walks through a purchase, a blocked request, the kill switch and Ghostbreaker.",
  },
];

const SectionTitle: React.FC<{ eyebrow: string; title: string; body?: string }> = ({ eyebrow, title, body }) => (
  <div className="max-w-hero space-y-3">
    <div className="caption-3 uppercase tracking-wider text-fg-subtle">{eyebrow}</div>
    <h2 className="heading-4">{title}</h2>
    {body && <p className="body-3 text-fg-muted">{body}</p>}
  </div>
);

const PrimaryCta: React.FC = () => (
  <a href="#/signin" className="btn btn-primary btn-md">
    Open the control room
    <ArrowRight size={18} aria-hidden="true" />
  </a>
);

export const LandingPage: React.FC<{ section?: string }> = ({ section }) => {
  useEffect(() => {
    if (!section) {
      window.scrollTo({ top: 0 });
      return;
    }
    const target = document.getElementById(section);
    target?.scrollIntoView({ block: "start" });
  }, [section]);

  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-canvas">
      <SkipLink />
      <FloatingNav current={section} />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        <section className="bg-warm px-4 pb-24 pt-24" aria-labelledby="hero-title">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
            <div className="view-enter space-y-6">
              <span className="badge badge-warn">
                <LockKey size={12} weight="bold" aria-hidden="true" />
                PayPal Sandbox only
              </span>
              <h1 id="hero-title" className="heading-1 gradient-heading max-w-hero">
                Automate refunds and discounts <br className="hidden sm:block" />
                without giving AI the keys to your money
              </h1>
              <p className="body-3 max-w-hero text-fg-muted">
                Ghost reads each customer request and proposes an action. A deterministic Trust Engine checks it against your
                Authority Passport before anything reaches PayPal Sandbox.
              </p>
              <div className="space-y-3">
                <PrimaryCta />
                <ul className="caption-5 flex flex-wrap gap-x-4 gap-y-1 text-fg-muted">
                  <li>10 Ghostbreaker attack cases</li>
                  <li>Every decision logged with reason codes</li>
                  <li>No real money, ever</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <DecisionExample />
            </div>
          </div>
        </section>

        <Reveal as="section" id="problem" className="px-4 py-24">
          <div className="mx-auto max-w-6xl space-y-8">
            <SectionTitle
              eyebrow="The problem"
              title="An agent with open access to payments can be talked into anything"
              body="Discounts that exceed policy, refunds nobody approved, duplicate payments and prompt injection all start the same way. The model is given authority it should never hold."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card space-y-3 p-6">
                <h3 className="title-2 text-fg-muted">Without limits</h3>
                <ul className="body-6 space-y-2 text-fg-muted">
                  <li>The model decides what it is allowed to do.</li>
                  <li>Customer text can override instructions.</li>
                  <li>Nobody can see why a payment ran.</li>
                  <li>Stopping it means finding the right script.</li>
                </ul>
              </div>
              <div className="card space-y-3 border-ok p-6">
                <h3 className="title-2">With Ghost</h3>
                <ul className="body-6 space-y-2 text-fg-muted">
                  <li>The model proposes. Policy code decides.</li>
                  <li>Customer text is data, never a command.</li>
                  <li>Each decision shows its checks and reason codes.</li>
                  <li>One button freezes new executions on the server.</li>
                </ul>
              </div>
            </div>
          </div>
        </Reveal>

        <section className="bg-warm px-4 py-24" aria-label="Core idea">
          <div className="mx-auto max-w-6xl">
            <TaglineReveal />
          </div>
        </section>

        <Reveal as="section" id="benefits" className="px-4 py-24">
          <div className="mx-auto max-w-6xl space-y-8">
            <SectionTitle eyebrow="Benefits" title="Autonomy with a boundary you can inspect" />
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map((benefit) => {
                const IconComponent = benefit.icon;
                return (
                  <li key={benefit.title} className="card-interactive space-y-3 p-6">
                    <div className="inline-flex rounded-xl border border-line bg-raised p-2 text-info">
                      <IconComponent size={22} aria-hidden="true" />
                    </div>
                    <h3 className="title-2">{benefit.title}</h3>
                    <p className="body-6 text-fg-muted">{benefit.body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </Reveal>

        <Reveal as="section" id="how-it-works" className="bg-warm px-4 py-24">
          <div className="mx-auto max-w-6xl space-y-8">
            <SectionTitle eyebrow="How it works" title="Three steps from request to audit record" />
            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map((step, index) => {
                const IconComponent = step.icon;
                return (
                  <li key={step.title} className="card space-y-3 p-6">
                    <div className="flex items-center justify-between">
                      <span className="num caption-3 text-fg-subtle">Step {index + 1}</span>
                      <IconComponent size={22} className="text-cyan" aria-hidden="true" />
                    </div>
                    <h3 className="title-2">{step.title}</h3>
                    <p className="body-6 text-fg-muted">{step.body}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </Reveal>

        <Reveal as="section" id="proof" className="px-4 py-24">
          <div className="mx-auto max-w-6xl space-y-8">
            <SectionTitle
              eyebrow="Proof"
              title="Ten attacks, each with an expected result you can check"
              body="Ghostbreaker runs these cases against the live Trust Engine and records the actual outcome. Expected results below come from the project README. Failed cases are shown, not hidden."
            />
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                ["Environment", "Sandbox only"],
                ["Operating modes", "4"],
                ["Attack cases", "10"],
                ["Approval binding", "SHA256"],
              ].map(([label, value]) => (
                <div key={label} className="card p-4">
                  <dt className="caption-4 text-fg-subtle">{label}</dt>
                  <dd className="heading-6 num mt-1">{value}</dd>
                </div>
              ))}
            </dl>
            <ul className="table-wrap divide-y divide-line">
              {ATTACKS.map((attack, index) => (
                <li key={attack.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className="body-5 flex items-center gap-3">
                    <span className="num caption-4 text-fg-subtle">{String(index + 1).padStart(2, "0")}</span>
                    {attack.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="caption-4 text-fg-subtle">Expected</span>
                    <span className={`badge ${attack.result === "Frozen" ? "badge-bad" : "badge-bad"}`}>{attack.result}</span>
                    <span className="num caption-4 text-fg-muted">{attack.code}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal as="section" id="faq" className="bg-warm px-4 py-24">
          <div className="mx-auto max-w-3xl space-y-8">
            <SectionTitle eyebrow="FAQ" title="Questions people ask before they trust an agent with payments" />
            <div className="space-y-2">
              {FAQ_ITEMS.map((item) => (
                <details key={item.q} className="card group p-4">
                  <summary className="body-5 flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg">
                    {item.q}
                    <span className="caption-3 shrink-0 text-fg-subtle group-open:hidden">Show</span>
                    <span className="caption-3 hidden shrink-0 text-fg-subtle group-open:inline">Hide</span>
                  </summary>
                  <p className="body-6 mt-3 text-fg-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal as="section" className="px-4 py-24">
          <div className="card mx-auto flex max-w-3xl flex-col items-center gap-6 p-8 text-center">
            <Clock size={28} className="text-fg-muted" aria-hidden="true" />
            <h2 className="heading-4 gradient-heading">See the Trust Engine block a bad request</h2>
            <p className="body-3 max-w-hero text-fg-muted">
              No card and no real money. Everything runs on PayPal Sandbox with synthetic demo data.
            </p>
            <PrimaryCta />
          </div>
        </Reveal>
      </main>
      <SiteFooter />
    </div>
  );
};
