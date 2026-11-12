import { NavView, isNavView } from "./nav";

export const LANDING_SECTIONS = ["benefits", "how-it-works", "proof", "faq"] as const;

export type Route =
  | { name: "landing"; section?: string }
  | { name: "signin" }
  | { name: "privacy" }
  | { name: "terms" }
  | { name: "app"; view: NavView; query: string }
  | { name: "notfound" };

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, "");
  const [pathPart, queryPart = ""] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean);

  if (segments.length === 0) return { name: "landing" };

  const [first, second] = segments;

  if (segments.length === 1) {
    if ((LANDING_SECTIONS as readonly string[]).includes(first)) return { name: "landing", section: first };
    if (first === "signin") return { name: "signin" };
    if (first === "privacy") return { name: "privacy" };
    if (first === "terms") return { name: "terms" };
    if (first === "app") return { name: "app", view: "overview", query: queryPart };
  }

  if (segments.length === 2 && first === "app" && isNavView(second)) {
    return { name: "app", view: second, query: queryPart };
  }

  return { name: "notfound" };
}

export function appHash(view: NavView, params?: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const query = search.toString();
  return `#/app/${view}${query ? `?${query}` : ""}`;
}

export function getQueryParam(query: string, key: string): string {
  return new URLSearchParams(query).get(key) ?? "";
}

export function navigateTo(hash: string) {
  if (window.location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  window.location.hash = hash;
}
