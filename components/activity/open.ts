"use client";

/**
 * The activity modal lives in the URL (`?activity=<id>`), so it can be linked to and the back
 * button closes it. Opening pushes a history entry without a server round trip (Next syncs
 * useSearchParams with history.pushState); closing goes back to that entry when this page made
 * it, or drops the parameter when the modal was opened from a link.
 */
export const ACTIVITY_PARAM = "activity";

let pushedHere = false;

export function openActivity(id: string) {
  const params = new URLSearchParams(window.location.search);
  params.set(ACTIVITY_PARAM, id);
  // Opening another activity from inside the modal replaces it, so back still closes the modal.
  if (new URLSearchParams(window.location.search).has(ACTIVITY_PARAM)) {
    window.history.replaceState(null, "", `?${params}`);
  } else {
    window.history.pushState(null, "", `?${params}`);
    pushedHere = true;
  }
}

export function closeActivity() {
  if (pushedHere) {
    pushedHere = false;
    window.history.back();
    return;
  }
  const params = new URLSearchParams(window.location.search);
  params.delete(ACTIVITY_PARAM);
  const query = params.toString();
  window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
}

/** The back button closed the modal: forget the entry so a later close doesn't go back twice. */
export function forgetPushed() {
  pushedHere = false;
}
