import React from "react";
import { ArrowRight, Ghost } from "../../components/icons";
import { FloatingNav, SiteFooter, SkipLink } from "./PublicChrome";

export const NotFoundPage: React.FC<{ signedIn?: boolean }> = ({ signedIn }) => (
  <div className="min-h-screen bg-canvas">
    <SkipLink />
    <FloatingNav showSections={false} />
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-6 px-4 pt-24 text-center focus:outline-none">
      <div className="rounded-2xl border border-line bg-surface p-4 text-fg-muted">
        <Ghost size={40} aria-hidden="true" />
      </div>
      <p className="num caption-3 text-fg-subtle">Error 404</p>
      <h1 className="heading-4 gradient-heading">This page drifted off</h1>
      <p className="body-3 text-fg-muted">
        The address you opened does not match any screen in Ghost. Nothing was changed. Head back and pick a screen from the
        navigation.
      </p>
      <a href={signedIn ? "#/app/overview" : "#/"} className="btn btn-primary btn-md">
        {signedIn ? "Back to the overview" : "Back to home"}
        <ArrowRight size={18} aria-hidden="true" />
      </a>
    </main>
    <SiteFooter />
  </div>
);
