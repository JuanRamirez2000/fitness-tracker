import { unstable_isUnrecognizedActionError } from "next/navigation";

/**
 * The message to show when a server action call throws. The usual cause is a page opened before
 * a deploy: its action ids no longer exist on the server, and only a reload fixes that. Anything
 * else is logged so it shows up in the browser console.
 */
export function actionErrorMessage(err: unknown, fallback: string): string {
  if (unstable_isUnrecognizedActionError(err)) {
    return "The site was updated since you opened this page. Reload it and try again.";
  }
  console.error(err);
  return fallback;
}
