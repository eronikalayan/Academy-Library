import { NavigationType, useBlocker } from 'react-router-dom';

/**
 * Blocks in-app React Router navigation (sidebar/nav links, the page's
 * own "Back to..." link, browser back/forward while still inside the
 * SPA) while `shouldBlock` is true — the gap the existing `beforeunload`
 * listener in `ResourceForm` can't cover, since that event only fires on
 * an actual full-page unload (tab close, refresh, typing a new URL),
 * never on a client-side route change (Task 05D).
 *
 * Exempts `historyAction === 'REPLACE'` unconditionally: both
 * `CreateResourcePage` and `EditResourcePage` navigate away with
 * `{ replace: true }` specifically on a *successful* submission (see
 * their own `onSuccess` handlers) — the one in-app navigation away from
 * a dirty form that must never be blocked. Every other in-app
 * navigation this form's page performs is a plain `PUSH`/`POP`, so this
 * single, declarative condition distinguishes "the user is leaving on
 * purpose after saving" from "the user is leaving some other way" without
 * depending on the relative timing of a mutation's success callback and
 * this component's own re-render (which a prop/ref-based "did we just
 * succeed" flag would).
 */
export function useUnsavedChangesBlocker(shouldBlock: boolean) {
  return useBlocker(({ historyAction }) => shouldBlock && historyAction !== NavigationType.Replace);
}
