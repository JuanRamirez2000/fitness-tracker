"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * "On this page", the way Tailwind's docs do it: the page's section questions, each with its
 * cards under it, and the one you're reading highlighted as you scroll. A sticky column beside
 * the content on a wide screen (`variant="sidebar"`); a floating button naming the current
 * section, which opens the same list, below that (`variant="button"`). Built from the page
 * itself (each section's h2, each card's `data-toc` title), so a new card shows up with no
 * wiring.
 */

interface TocItem {
  id: string;
  label: string;
  children: { id: string; label: string }[];
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

/** Visible on the page: not in a closed fold, not in a hidden streaming copy. */
const shown = (el: Element) => (el as HTMLElement).offsetParent !== null || el.getClientRects().length > 0;

function readToc(): TocItem[] {
  const main = document.querySelector("main");
  if (!main) return [];
  const used = new Set<string>();
  const idFor = (el: HTMLElement, base: string) => {
    if (el.id) return el.id;
    let id = slug(base) || "section";
    for (let n = 2; used.has(id) || document.getElementById(id); n++) id = `${slug(base)}-${n}`;
    el.id = id;
    return id;
  };
  const items: TocItem[] = [];
  for (const section of main.querySelectorAll<HTMLElement>("section")) {
    if (section.closest("[hidden]") || section.matches("[aria-roledescription=carousel]")) continue;
    const h2 = section.querySelector(":scope > div h2, :scope > div > div h2");
    if (!h2 || !shown(h2)) continue;
    // The heading's words, without a sport badge beside them.
    const copy = h2.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("span.rounded-full").forEach((b) => b.remove());
    const label = (copy.textContent ?? "").trim();
    const id = idFor(section, label);
    used.add(id);
    const children: TocItem["children"] = [];
    if (section.querySelector(":scope > [aria-roledescription=carousel]")) {
      const c = section.querySelector<HTMLElement>(":scope > [aria-roledescription=carousel]")!;
      children.push({ id: idFor(c, `${id}-in-focus`), label: "In focus" });
    }
    for (const card of section.querySelectorAll<HTMLElement>("[data-toc]")) {
      if (card.closest("[aria-roledescription=carousel], details:not([open])") || card.closest("section") !== section || !shown(card)) continue;
      const cardId = idFor(card, `${id}-${card.dataset.toc}`);
      used.add(cardId);
      children.push({ id: cardId, label: card.dataset.toc! });
    }
    items.push({ id, label, children });
  }
  return items;
}

/** The section and card whose top has passed just under the sticky header. */
function activeIds(items: TocItem[]): { section: string | null; card: string | null } {
  const line = (document.querySelector("header")?.getBoundingClientRect().height ?? 0) + 48;
  let section: string | null = items[0]?.id ?? null;
  let card: string | null = null;
  for (const item of items) {
    const top = document.getElementById(item.id)?.getBoundingClientRect().top ?? Infinity;
    if (top > line) break;
    section = item.id;
    card = null;
    // Cards side by side share a top: the first (left) one of the row wins.
    let cardTop = -Infinity;
    for (const c of item.children) {
      const ct = document.getElementById(c.id)?.getBoundingClientRect().top ?? Infinity;
      if (ct <= line && ct > cardTop + 2) {
        card = c.id;
        cardTop = ct;
      }
    }
  }
  // At the very bottom, the last section is the one being read.
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4 && items.length) section = items.at(-1)!.id;
  return { section, card };
}

function useToc() {
  const [items, setItems] = useState<TocItem[]>([]);
  const [active, setActive] = useState<{ section: string | null; card: string | null }>({ section: null, card: null });

  const refresh = useCallback(() => setItems(readToc()), []);
  useEffect(() => {
    // Debounced on a timer rather than a frame: a background tab still gets its list.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 60);
    };
    schedule();
    const main = document.querySelector("main");
    const mo = new MutationObserver(schedule);
    if (main) mo.observe(main, { childList: true, subtree: true });
    document.addEventListener("toggle", schedule, true);
    return () => {
      clearTimeout(timer);
      mo.disconnect();
      document.removeEventListener("toggle", schedule, true);
    };
  }, [refresh]);

  useEffect(() => {
    const update = () => setActive(activeIds(items));
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items]);
  return { items, active };
}

function jump(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", `${location.pathname}${location.search}#${id}`);
}

function List({ items, active, onPick }: { items: TocItem[]; active: { section: string | null; card: string | null }; onPick?: () => void }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => {
        const on = item.id === active.section;
        return (
          <li key={item.id} className="flex flex-col gap-1.5">
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                jump(item.id);
                onPick?.();
              }}
              aria-current={on && !active.card ? "location" : undefined}
              className={`text-[13px] leading-snug font-medium transition-colors ${on ? "text-ink" : "text-muted-1 hover:text-ink"}`}
            >
              {item.label}
            </a>
            {item.children.length > 0 && (
              <ul className="flex flex-col border-l border-border">
                {item.children.map((c) => {
                  const cardOn = c.id === active.card;
                  return (
                    <li key={c.id}>
                      <a
                        href={`#${c.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          jump(c.id);
                          onPick?.();
                        }}
                        aria-current={cardOn ? "location" : undefined}
                        className={`-ml-px block border-l py-[3px] pl-3 text-[12.5px] leading-snug transition-colors ${
                          cardOn ? "border-accent text-accent" : "border-transparent text-muted-2 hover:border-border-strong hover:text-ink"
                        }`}
                      >
                        {c.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function PageToc({ variant }: { variant: "sidebar" | "button" }) {
  const { items, active } = useToc();
  const [open, setOpen] = useState(false);

  // The button's panel closes on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (items.length < 2) return null;

  if (variant === "sidebar") {
    return (
      <nav aria-label="On this page" className="sticky top-[var(--header-h,7rem)] max-h-[calc(100vh-var(--header-h,7rem))] overflow-y-auto overscroll-contain pt-8 pb-10 [scrollbar-width:thin]">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">On this page</p>
        <List items={items} active={active} />
      </nav>
    );
  }

  const current = items.find((i) => i.id === active.section);
  return (
    <div className="fixed right-4 bottom-4 z-30 flex flex-col items-end gap-2 xl:hidden">
      {open && (
        <>
          <button type="button" aria-label="Close" className="fixed inset-0 -z-10 cursor-default" onClick={() => setOpen(false)} />
          <nav aria-label="On this page" className="max-h-[60vh] w-[min(300px,calc(100vw-32px))] overflow-y-auto overscroll-contain rounded-xl border border-border-strong bg-card px-4 py-4 shadow-xl">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-2">On this page</p>
            <List items={items} active={active} onPick={() => setOpen(false)} />
          </nav>
        </>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex max-w-[calc(100vw-32px)] items-center gap-2 rounded-full border border-border-strong bg-card/95 px-3.5 py-2 text-[12.5px] text-ink shadow-lg backdrop-blur"
      >
        <span aria-hidden className="text-muted-2">☰</span>
        <span className="truncate">{current?.label ?? "On this page"}</span>
      </button>
    </div>
  );
}
