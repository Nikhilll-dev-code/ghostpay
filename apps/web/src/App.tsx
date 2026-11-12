import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import { parseRoute, appHash, getQueryParam } from "./lib/route";
import type { Route } from "./lib/route";
import { NAV_ITEMS } from "./lib/nav";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { SkipLink } from "./views/public/PublicChrome";
import { LandingPage } from "./views/public/LandingPage";
import { PrivacyPage, TermsPage } from "./views/public/LegalPages";
import { NotFoundPage } from "./views/public/NotFoundPage";
import { LoginView } from "./views/LoginView";
import { OverviewView } from "./views/OverviewView";
import { GhostBrainView } from "./views/GhostBrainView";
import { TransactionsView } from "./views/TransactionsView";
import { ApprovalsView } from "./views/ApprovalsView";
import { CustomersView } from "./views/CustomersView";
import { AuthorityView } from "./views/AuthorityView";
import { WhatIfView } from "./views/WhatIfView";
import { GhostbreakerView } from "./views/GhostbreakerView";
import { AuditView } from "./views/AuditView";
import { SettingsView } from "./views/SettingsView";
import { Skeleton } from "./components/ui";

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

const AppShell: React.FC<{ route: Extract<Route, { name: "app" }> }> = ({ route }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const title = NAV_ITEMS.find((item) => item.id === route.view)?.label ?? "Ghost 3.0";
    document.title = `${title} | Ghost 3.0`;
  }, [route.view]);

  const q = getQueryParam(route.query, "q");
  const status = getQueryParam(route.query, "status");
  const filterKey = `${route.view}:${route.query}`;

  const renderView = () => {
    switch (route.view) {
      case "overview":
        return <OverviewView />;
      case "brain":
        return <GhostBrainView />;
      case "transactions":
        return <TransactionsView key={filterKey} initialQuery={q} initialStatus={status} />;
      case "approvals":
        return <ApprovalsView key={filterKey} initialStatus={status} />;
      case "customers":
        return <CustomersView />;
      case "authority":
        return <AuthorityView />;
      case "whatif":
        return <WhatIfView />;
      case "ghostbreaker":
        return <GhostbreakerView />;
      case "audit":
        return <AuditView key={filterKey} initialQuery={q} />;
      case "settings":
        return <SettingsView />;
    }
  };

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <SkipLink />
      <Header onOpenMenu={() => setMenuOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar currentView={route.view} mobileOpen={menuOpen} onCloseMobile={closeMenu} />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto focus:outline-none">
          <div key={route.view} className="view-enter mx-auto w-full max-w-7xl p-4 lg:p-6">
            {renderView()}
          </div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
};

const App: React.FC = () => {
  const { user, isLoading } = useAuth();
  const route = useRoute();

  useEffect(() => {
    if (isLoading) return;
    if (user && (route.name === "landing" || route.name === "signin")) {
      window.location.hash = appHash("overview");
    } else if (!user && route.name === "app") {
      window.location.hash = "#/signin";
    }
  }, [user, isLoading, route.name]);

  useEffect(() => {
    if (route.name === "landing") document.title = "Ghost 3.0 | Policy governed AI for refunds, discounts and payments";
    if (route.name === "signin") document.title = "Sign in | Ghost 3.0";
    if (route.name === "privacy") document.title = "Privacy policy | Ghost 3.0";
    if (route.name === "terms") document.title = "Terms of use | Ghost 3.0";
    if (route.name === "notfound") document.title = "Page not found | Ghost 3.0";
  }, [route.name]);

  if (isLoading && route.name === "app") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas" role="status" aria-label="Loading workspace">
        <div className="w-64 space-y-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    );
  }

  switch (route.name) {
    case "landing":
      return user ? null : <LandingPage section={route.section} />;
    case "signin":
      return user ? null : <LoginView />;
    case "privacy":
      return <PrivacyPage />;
    case "terms":
      return <TermsPage />;
    case "app":
      return user ? <AppShell route={route} /> : null;
    default:
      return <NotFoundPage signedIn={!!user} />;
  }
};

export default App;
