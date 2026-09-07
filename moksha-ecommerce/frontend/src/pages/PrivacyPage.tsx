import { Link } from "react-router-dom";

import { Container } from "@/components/layout/Container";

/**
 * The privacy policy.
 *
 * Google requires a reachable privacy policy URL before an OAuth consent screen
 * can leave Testing mode, which is what prompted this page. But the requirement
 * is not the reason it says what it says.
 *
 * Three things here are worth being explicit about, because a reader cannot
 * verify them from the outside:
 *
 * 1. The Google ID token is verified server-side against Google's public keys.
 *    A client-side claim of identity is not an identity.
 * 2. Card details never touch this server. Stripe Checkout is hosted by Stripe,
 *    and the app only ever sees a session id and a signed webhook.
 * 3. Support-chat messages leave for Anthropic. An application that sends user
 *    content to a third-party model provider and does not say so has a real
 *    gap, regardless of what any consent screen demands.
 *
 * Written as prose rather than legal boilerplate: this is a technical
 * assignment, and a fabricated corporate policy would be less honest than a
 * plain description of what the code actually does.
 */
export function PrivacyPage() {
  return (
    <Container narrow className="py-14">
      <p className="label-caps">Privacy</p>
      <h1 className="mt-1 font-display text-3xl text-ink">What this app stores</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Moksha is a technical assignment, not a real shop. No real money moves and no order is
        ever fulfilled. This page describes exactly what the running application does with data,
        in plain terms.
      </p>

      <div className="mt-10 flex flex-col gap-8">
        <Section title="Signing in">
          <p>
            Sign-in uses Google. When you sign in, Google issues an ID token to your browser and
            the app sends it to its own server, which verifies the signature against Google&rsquo;s
            published public keys before trusting anything in it. Only then is a session created.
          </p>
          <p>
            From that verified token the app stores three things: your <Term>name</Term>, your{" "}
            <Term>email address</Term> and the <Term>URL of your Google avatar</Term>. It does not
            receive or store your Google password, and it does not request access to any other
            Google service — the only scopes asked for are <Code>openid</Code>, <Code>email</Code>{" "}
            and <Code>profile</Code>.
          </p>
        </Section>

        <Section title="Orders">
          <p>
            Placing an order stores the products, quantities and prices at the moment you bought
            them, linked to your account so that order history works. Prices are recorded as they
            were at purchase time, so a later change to a product does not silently rewrite what
            you paid.
          </p>
          <p>
            You can only read your own orders. This is enforced on the server, not by hiding
            buttons in the interface.
          </p>
        </Section>

        <Section title="Payments">
          <p>
            Payments run through <Term>Stripe in test mode</Term>. Card details are entered on
            Stripe&rsquo;s own hosted checkout page and never reach this application&rsquo;s
            servers — it only ever sees a Stripe session identifier and a signed notification
            confirming the outcome.
          </p>
          <p>
            Because it is test mode, no real card is ever charged. Stripe&rsquo;s published test
            card numbers are the only ones that will work.
          </p>
        </Section>

        <Section title="The support assistant">
          <p>
            The chat assistant answers questions about products and about your own orders. To do
            that, the message you type is sent to <Term>Anthropic</Term>, which generates the
            reply. Product details and your own order records may be included so the answer is
            based on real data rather than guesswork.
          </p>
          <p>
            The assistant is scoped to you. Its access to order data is bound to your verified
            session on the server, so it cannot be talked into reading someone else&rsquo;s
            orders.
          </p>
        </Section>

        <Section title="What is not collected">
          <p>
            No analytics, no advertising trackers, no third-party cookies, no location data. The
            app sets no marketing cookies and sells nothing to anyone.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            Email{" "}
            <a
              href="mailto:ganeshdev447@gmail.com"
              className="rounded-sm text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-ink"
            >
              ganeshdev447@gmail.com
            </a>{" "}
            and the account and its orders will be removed. As this is an assignment demo, the
            database may also be reset without notice.
          </p>
        </Section>
      </div>

      <p className="mt-12 border-t border-line pt-6 text-2xs leading-relaxed text-ink-subtle">
        Last updated 8 September 2026.{" "}
        <Link to="/products" className="rounded-sm transition-colors hover:text-ink">
          Back to the shop
        </Link>
      </p>
    </Container>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <div className="mt-2 flex flex-col gap-2.5 text-sm leading-relaxed text-ink-muted">
        {children}
      </div>
    </section>
  );
}

/** Emphasis for the specific thing being described, without shouting. */
function Term({ children }: { children: React.ReactNode }) {
  return <span className="text-ink">{children}</span>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-sm bg-surface-sunken px-1 py-0.5 font-mono text-2xs text-ink">
      {children}
    </code>
  );
}
