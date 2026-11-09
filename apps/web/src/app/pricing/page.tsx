
import Link from "next/link";

const plans = [
  {
    name: "Free",
    description: "Everything you need to get started.",
    price: "₹0",
    period: "/month",
    highlight: false,
    features: [
      "Up to 3 forms",
      "100 responses per month",
      "Basic form builder",
      "Conditional logic",
      "Basic analytics",
      "Ready-made templates",
      "Standard themes",
      "FormFlow branding",
    ],
    button: "Get Started for Free",
    href: "/signup",
  },
  {
    name: "Pro",
    description: "More power for growing creators.",
    price: "₹299",
    period: "/month",
    highlight: true,
    features: [
      "Up to 20 forms",
      "2,000 responses per month",
      "Everything in Free",
      "Advanced analytics",
      "All themes and customization",
      "Remove FormFlow branding",
      "Priority support",
    ],
    button: "Get Started with Pro",
    href: "/signup",
  },
  {
    name: "Business",
    description: "Built for teams and growing businesses.",
    price: "₹799",
    period: "/month",
    highlight: false,
    features: [
      "Unlimited forms",
      "10,000 responses per month",
      "Everything in Pro",
      "Team collaboration",
      "Advanced customization",
      "Custom branding",
      "Priority support",
    ],
    button: "Choose Business",
    href: "/signup",
  },
];

const faqs = [
  {
    question: "Can I start using FormFlow for free?",
    answer:
      "Yes! You can create a free account and start building forms without paying anything.",
  },
  {
    question: "Can I upgrade my plan later?",
    answer:
      "Yes. You will be able to upgrade when you need higher limits and additional features.",
  },
  {
    question: "Will my forms and responses be safe?",
    answer:
      "Your forms and responses are stored in our database. We will monitor storage and maintain appropriate infrastructure as FormFlow grows.",
  },
  {
    question: "Can I cancel my Pro or Business plan?",
    answer:
      "Subscription management and cancellation options will be available when paid plans launch.",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#fffefa] text-[#302e29]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-[#eeeae2] bg-[#fffefa]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#302e29] text-lg font-bold text-white">
              F
            </span>
            <span className="text-xl font-bold tracking-tight">
              FormFlow<span className="text-[#a18d68]">.</span>
            </span>
          </Link>

          <div className="flex items-center gap-4 text-xs font-medium sm:gap-7">
            <Link href="/" className="text-[#77746c] hover:text-[#302e29]">
              Home
            </Link>
            <Link href="/explore" className="text-[#77746c] hover:text-[#302e29]">
              Explore
            </Link>
            <Link href="/login" className="hidden sm:block">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[#302e29] px-5 py-2.5 font-semibold text-white transition hover:bg-[#51483e]"
            >
              Get Started →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pb-10 pt-16 text-center sm:pt-20">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a18d68]">
          Simple & transparent pricing
        </p>

        <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
          Plans that grow with you.
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#77746c]">
          Start for free, explore your creativity and upgrade when
          you need more power. Choose the plan that works for you.
        </p>

        <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-[#e9e3d7] bg-[#f7f3e9] px-4 py-2 text-[10px] font-semibold text-[#786b55]">
          ✦ Early pricing preview · Paid subscriptions coming soon
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-5 pb-20 sm:px-8">
        <div className="mx-auto grid max-w-6xl items-stretch gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-[24px] border p-7 transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
                plan.highlight
                  ? "border-[#a18d68] bg-[#faf8f2] shadow-lg shadow-[#77674b]/10"
                  : "border-[#e9e3d7] bg-white shadow-sm"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#a18d68] px-4 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white">
                  Most Popular
                </span>
              )}

              <div>
                <h2 className="text-lg font-bold">{plan.name}</h2>
                <p className="mt-2 min-h-10 text-xs leading-5 text-[#888176]">
                  {plan.description}
                </p>

                <div className="mt-7 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-xs text-[#999184]">
                    {plan.period}
                  </span>
                </div>

                <p className="mt-2 text-[10px] text-[#999184]">
                  {plan.name === "Free"
                    ? "No credit card required"
                    : "Proposed launch price"}
                </p>
              </div>

              <Link
                href={plan.href}
                className={`mt-7 block rounded-xl py-3.5 text-center text-xs font-semibold transition ${
                  plan.highlight
                    ? "bg-[#302e29] text-white hover:bg-[#51483e]"
                    : "border border-[#d9d2c4] bg-white hover:bg-[#f5f1e8]"
                }`}
              >
                {plan.button} →
              </Link>

              <div className="my-7 border-t border-[#e9e3d7]" />

              <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#a18d68]">
                What's included
              </p>

              <ul className="flex-1 space-y-4">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-xs text-[#68645c]"
                  >
                    <span className="mt-[-1px] font-bold text-[#8d7957]">
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-7 max-w-3xl text-center text-[10px] leading-5 text-[#999184]">
          Plan limits and features are proposed launch details and may
          change before paid subscriptions become available.
        </p>
      </section>

      {/* FAQ */}
      <section className="bg-[#f7f5ef] px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a18d68]">
              Got questions?
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              Frequently asked questions
            </h2>
          </div>

          <div className="mt-10 space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-[#e9e3d7] bg-white p-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-xs font-bold">
                  {faq.question}
                  <span className="text-lg text-[#a18d68] transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-xs leading-6 text-[#77746c]">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl rounded-[25px] bg-[#302e29] px-7 py-14 text-center text-white sm:px-14">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7c7a6]">
            Start creating today
          </p>
          <h2 className="mx-auto mt-4 max-w-xl text-3xl font-bold">
            Great forms start with a simple idea.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-xs leading-6 text-[#d0cbc1]">
            Join FormFlow and bring your next idea to life.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex rounded-full bg-[#ebe2cc] px-7 py-3.5 text-xs font-bold text-[#302e29] transition hover:bg-white"
          >
            Create Your Free Account →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#eeeae2] px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-center sm:flex-row sm:items-center sm:text-left">
          <Link href="/" className="text-lg font-bold">
            FormFlow<span className="text-[#a18d68]">.</span>
          </Link>
          <p className="text-[10px] text-[#999184]">
            © 2026 FormFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
