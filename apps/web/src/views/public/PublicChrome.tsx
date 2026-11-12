import React, { useEffect, useState } from "react";
import { ArrowRight, Ghost, X } from "../../components/icons";
import { useReveal } from "../../lib/hooks";

export const LANDING_LINKS = [
  { id: "benefits", label: "Benefits" },
  { id: "how-it-works", label: "How it works" },
  { id: "proof", label: "Proof" },
  { id: "faq", label: "FAQ" },
];

export const SkipLink: React.FC = () => (
  <a
    href="#main"
    onClick={(event) => {
      event.preventDefault();
      const target = document.getElementById("main");
      target?.focus();
      target?.scrollIntoView({ block: "start" });
    }}
    className="btn btn-primary absolute left-4 top-4 z-[70] -translate-y-24 focus:translate-y-0"
  >
    Skip to main content
  </a>
);

export const Reveal: React.FC<{
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
  id?: string;
  delayMs?: number;
}> = ({ children, className = "", as: Tag = "div", id, delayMs = 0 }) => {
  const { ref, visible } = useReveal<HTMLElement>();
  return (
    <Tag
      id={id}
      ref={ref as React.RefObject<any>}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
};

export const FloatingNav: React.FC<{ current?: string; showSections?: boolean }> = ({ current, showSections = true }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const links = showSections ? LANDING_LINKS : [{ id: "", label: "Back to home" }];

  return (
    <>
      <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <nav
          aria-label="Main"
          className="flex items-center gap-4 rounded-2xl border border-line bg-surface/70 px-3 py-2 backdrop-blur-xl"
        >
          <a href="#/" className="flex items-center gap-2 rounded-lg pr-2" aria-label="Ghost 3.0 home">
            <Ghost size={22} weight="fill" aria-hidden="true" />
            <span className="title-4">Ghost 3.0</span>
          </a>

          <ul className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <li key={link.id || "home"}>
                <a
                  href={link.id ? `#/${link.id}` : "#/"}
                  aria-current={current === link.id && link.id ? "location" : undefined}
                  className="body-5 motion-color rounded-lg px-3 py-1 text-fg-muted hover:bg-hover hover:text-fg aria-[current=location]:text-fg"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <a href="#/signin" className="btn btn-primary hidden md:inline-flex">
            Sign in
          </a>

          <button
            type="button"
            className="btn btn-ghost p-2 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="relative block h-4 w-5" aria-hidden="true">
              <span
                className="menu-line absolute left-0 h-0.5 w-5 rounded-full bg-fg"
                style={{ top: open ? "7px" : "2px", transform: open ? "rotate(45deg)" : "none" }}
              />
              <span
                className="menu-line absolute left-0 top-[7px] h-0.5 w-5 rounded-full bg-fg"
                style={{ opacity: open ? 0 : 1 }}
              />
              <span
                className="menu-line absolute left-0 h-0.5 w-5 rounded-full bg-fg"
                style={{ top: open ? "7px" : "12px", transform: open ? "rotate(-45deg)" : "none" }}
              />
            </span>
          </button>
        </nav>
      </header>

      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!open}
        className={`fixed inset-0 z-40 flex flex-col justify-center gap-6 bg-canvas/95 px-8 backdrop-blur-2xl md:hidden ${
          open ? "menu-open visible opacity-100" : "invisible opacity-0"
        }`}
        style={{ transition: "opacity 500ms cubic-bezier(0.22, 1, 0.36, 1), visibility 500ms" }}
      >
        <ul className="space-y-2">
          {links.map((link, index) => (
            <li key={link.id || "home"} className="menu-item" style={{ transitionDelay: open ? `${Math.min(index * 60, 400)}ms` : "0ms" }}>
              <a
                href={link.id ? `#/${link.id}` : "#/"}
                tabIndex={open ? 0 : -1}
                onClick={() => setOpen(false)}
                className="heading-4 block rounded-lg py-2"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="menu-item" style={{ transitionDelay: open ? `${Math.min(links.length * 60, 400)}ms` : "0ms" }}>
          <a href="#/signin" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} className="btn btn-primary btn-md w-full">
            Sign in
            <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
          className="btn btn-ghost absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <X size={16} aria-hidden="true" />
          Close menu
        </button>
      </div>
    </>
  );
};

export const SiteFooter: React.FC<{ current?: "privacy" | "terms" }> = ({ current }) => (
  <footer className="border-t border-line bg-warm">
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 md:flex-row md:items-start md:justify-between">
      <div className="max-w-sm space-y-3">
        <div className="flex items-center gap-2">
          <Ghost size={22} weight="fill" aria-hidden="true" />
          <span className="title-3">Ghost 3.0</span>
        </div>
        <p className="caption-5 text-fg-muted">
          A policy governed AI financial operations agent, built for the PayPal hackathon. It runs on PayPal Sandbox only
          and never moves real money.
        </p>
        <p className="caption-5 text-fg-subtle">
          PayPal is a trademark of PayPal, Inc. Ghost is an independent prototype and is not endorsed by PayPal.
        </p>
      </div>
      <nav aria-label="Footer">
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <a href="#/signin" className="body-6 text-fg-muted hover:text-fg motion-color">
              Sign in
            </a>
          </li>
          <li>
            <a
              href="#/privacy"
              aria-current={current === "privacy" ? "page" : undefined}
              className="body-6 text-fg-muted hover:text-fg motion-color aria-[current=page]:text-fg"
            >
              Privacy policy
            </a>
          </li>
          <li>
            <a
              href="#/terms"
              aria-current={current === "terms" ? "page" : undefined}
              className="body-6 text-fg-muted hover:text-fg motion-color aria-[current=page]:text-fg"
            >
              Terms of use
            </a>
          </li>
        </ul>
      </nav>
    </div>
  </footer>
);
