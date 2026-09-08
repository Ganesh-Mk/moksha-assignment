/**
 * The "it went in the cart" animation: a ghost of the product image arcs from
 * wherever it was clicked into the cart button, which then bumps.
 *
 * **Why this lives outside React.** It is pure feedback — it owns no
 * application state and nothing renders differently because of it. Driving it
 * through React would mean a state update per frame, a portal, and a flight
 * that dies mid-air the moment its owning component unmounts (which is exactly
 * what happens when you add to the cart and immediately navigate). A detached
 * node animated by the Web Animations API has none of those problems and is
 * about forty lines.
 *
 * **The cart quantity is NOT updated when the ghost lands.** It updates on
 * click, immediately, as it should — the store is the truth and must never wait
 * on an animation. The ghost is a second, slower explanation of something that
 * already happened, which is the honest way round.
 */

/** Set by the header. Module-level because there is exactly one cart button. */
let cartTarget: HTMLElement | null = null;

export function registerCartTarget(element: HTMLElement | null): void {
  cartTarget = element;
}

const FLIGHT_MS = 620;
const LANDING_PX = 34;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A short squash-and-settle on the cart button, so the landing has a consequence. */
export function bumpCart(): void {
  if (!cartTarget || prefersReducedMotion()) return;
  cartTarget.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.14)", offset: 0.35 },
      { transform: "scale(0.97)", offset: 0.62 },
      { transform: "scale(1)" },
    ],
    { duration: 420, easing: "cubic-bezier(0.34, 1.4, 0.64, 1)" },
  );
}

export function flyToCart(source: HTMLElement | null, imageUrl: string | null): void {
  if (!source || !cartTarget) return;

  // Someone who has asked for less motion still needs to know the click worked;
  // they get the badge increment, which is not motion for its own sake.
  if (prefersReducedMotion()) return;

  const from = source.getBoundingClientRect();
  const to = cartTarget.getBoundingClientRect();
  if (from.width === 0 || to.width === 0) return;

  const ghost = document.createElement("div");
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.cssText = [
    "position:fixed",
    `left:${from.left}px`,
    `top:${from.top}px`,
    `width:${from.width}px`,
    `height:${from.height}px`,
    "border-radius:14px",
    "overflow:hidden",
    "pointer-events:none",
    "z-index:60",
    "will-change:transform,opacity",
    "background:var(--surface-sunken)",
    "box-shadow:var(--shadow-overlay)",
  ].join(";");

  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = "";
    image.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
    ghost.append(image);
  }

  document.body.append(ghost);

  const scale = LANDING_PX / from.width;
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  // Lift the midpoint so the path is an arc rather than a straight diagonal. A
  // straight line reads as a UI element being repositioned; an arc reads as an
  // object being thrown, which is the metaphor.
  const lift = Math.min(160, Math.abs(dx) * 0.28 + 60);

  const flight = ghost.animate(
    [
      { transform: "translate(0px, 0px) scale(1)", opacity: 1, easing: "cubic-bezier(0.3,0,0.2,1)" },
      {
        transform: `translate(${dx * 0.55}px, ${dy * 0.4 - lift}px) scale(${(1 + scale) / 2})`,
        opacity: 1,
        offset: 0.55,
        // Accelerating into the cart on the second half is what sells the throw.
        easing: "cubic-bezier(0.6,0,0.9,0.7)",
      },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.15 },
    ],
    { duration: FLIGHT_MS, fill: "forwards" },
  );

  flight.finished
    .catch(() => undefined) // a cancelled flight is not an error worth surfacing
    .finally(() => {
      ghost.remove();
      bumpCart();
    });
}
