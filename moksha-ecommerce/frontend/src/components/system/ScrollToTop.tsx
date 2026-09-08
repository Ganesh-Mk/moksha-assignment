import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Start every new page at the top.
 *
 * A single-page app does not reload, so the scroll position simply stays where
 * the last page left it — land on a product from halfway down the shop and you
 * arrive halfway down the product.
 *
 * **`behavior: "instant"`, deliberately, even though the app sets
 * `scroll-behavior: smooth` globally.** A smooth scroll on navigation animates
 * the *new* page from wherever the old one was, so you watch content you have
 * never seen race past on the way up. It reads as a glitch, not a transition.
 * The explicit `instant` overrides the stylesheet for this one case and leaves
 * in-page anchor links smooth, which is what that rule is actually for.
 *
 * The transition people want from this is supplied instead by the fade the
 * routed page mounts with — motion that says "this is new" rather than motion
 * that re-shows the old.
 *
 * `POP` is skipped: going back should return you to where you were, and a
 * browser restores that itself.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "POP") return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, navigationType]);

  return null;
}
