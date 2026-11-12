import React, { useEffect } from "react";
import { FloatingNav, SiteFooter, SkipLink } from "./PublicChrome";

const LegalShell: React.FC<{ title: string; updated: string; current: "privacy" | "terms"; children: React.ReactNode }> = ({
  title,
  updated,
  current,
  children,
}) => {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  return (
    <div className="min-h-screen bg-canvas">
      <SkipLink />
      <FloatingNav showSections={false} />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl space-y-8 px-4 pb-24 pt-24 focus:outline-none">
        <header className="space-y-2">
          <h1 className="heading-3 gradient-heading">{title}</h1>
          <p className="caption-5 text-fg-subtle">Last updated {updated}</p>
        </header>
        <div className="space-y-6 [&_h2]:title-1 [&_h2]:mb-2 [&_p]:body-6 [&_p]:text-fg-muted [&_ul]:body-6 [&_ul]:space-y-1 [&_ul]:text-fg-muted">
          {children}
        </div>
      </main>
      <SiteFooter current={current} />
    </div>
  );
};

export const PrivacyPage: React.FC = () => (
  <LegalShell title="Privacy policy" updated="November 2026" current="privacy">
    <section>
      <h2>What this is</h2>
      <p>
        Ghost 3.0 is a hackathon prototype. It is not a production payment service, and it does not process real payments or
        real customer data.
      </p>
    </section>
    <section>
      <h2>Data in the demo</h2>
      <ul>
        <li>Customers, fixtures and seeded transactions are synthetic demo data.</li>
        <li>Sign in sessions use a token kept in your browser storage until you sign out.</li>
        <li>Records are stored in the database of the instance you run, for example a local SQLite file.</li>
        <li>The audit trail redacts sensitive fields before storing event payloads.</li>
      </ul>
    </section>
    <section>
      <h2>Payment credentials</h2>
      <p>
        PayPal Sandbox credentials are read on the server from environment variables. They are never sent to the browser and
        should never be committed to a repository.
      </p>
    </section>
    <section>
      <h2>Third parties</h2>
      <p>
        When you connect PayPal Sandbox credentials, the server calls the PayPal Sandbox API. Without them, a built in
        simulation runs and no external payment call is made. This site loads no analytics or advertising scripts.
      </p>
    </section>
    <section>
      <h2>Before any real use</h2>
      <p>
        A production deployment needs its own privacy review, retention rules and legal text. This page describes the
        prototype only.
      </p>
    </section>
  </LegalShell>
);

export const TermsPage: React.FC = () => (
  <LegalShell title="Terms of use" updated="November 2026" current="terms">
    <section>
      <h2>Prototype status</h2>
      <p>
        Ghost 3.0 is provided as a hackathon demonstration without warranty. It works against PayPal Sandbox and must not be
        used to move real money.
      </p>
    </section>
    <section>
      <h2>Acceptable use</h2>
      <ul>
        <li>Use only Sandbox accounts and synthetic data.</li>
        <li>Do not enter real card numbers, passwords or personal data.</li>
        <li>Do not attempt to bypass the policy checks outside the provided Ghostbreaker suite.</li>
      </ul>
    </section>
    <section>
      <h2>No financial advice or certification</h2>
      <p>
        Risk rules and simulations are deterministic demonstrations. They are not fraud guarantees, regulatory
        certifications or financial advice.
      </p>
    </section>
    <section>
      <h2>Trademarks</h2>
      <p>PayPal is a trademark of PayPal, Inc. Ghost is an independent project and is not endorsed by PayPal.</p>
    </section>
  </LegalShell>
);
