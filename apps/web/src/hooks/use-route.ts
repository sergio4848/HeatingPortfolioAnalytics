import { useEffect, useState } from "react";
export type Page =
  | "home"
  | "portfolio"
  | "building"
  | "import"
  | "tasks"
  | "monitoring"
  | "settings";
const pages: Page[] = [
  "home",
  "portfolio",
  "building",
  "import",
  "tasks",
  "monitoring",
  "settings",
];
function readRoute() {
  const [raw, id] = window.location.hash.replace(/^#\/?/, "").split("/");
  const page = pages.includes(raw as Page) ? (raw as Page) : "home";
  let selected: string | null = null;
  try {
    selected = page === "building" && id ? decodeURIComponent(id) : null;
  } catch {
    /* Malformed URLs fall back to missing-resource view. */
  }
  return { page, selected };
}
export function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  function go(page: Page, building?: string) {
    const hash =
      page === "home"
        ? "#/"
        : page === "building"
          ? `#/building/${encodeURIComponent(building ?? "")}`
          : `#/${page}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    setRoute({
      page,
      selected: page === "building" ? (building ?? null) : null,
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  return { ...route, go };
}
