
"use client";

import Link from "next/link";
import { useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from "motion/react";

const features = [
  {
    icon: "✦",
    title: "Beautiful Form Builder",
    description:
      "Create elegant forms with an intuitive builder and customize every detail.",
  },
  {
    icon: "◇",
    title: "Conditional Logic",
    description:
      "Build smarter forms that adapt questions based on previous answers.",
  },
  {
    icon: "▥",
    title: "Powerful Analytics",
    description:
      "Understand responses through organized insights and visual analytics.",
  },
  {
    icon: "▤",
    title: "Ready-made Templates",
    description:
      "Start faster with customizable templates for surveys, quizzes and feedback.",
  },
];

const questions = [
  {
    title: "How was your experience?",
    subtitle: "We would love to hear your feedback.",
    options: ["Excellent", "Good", "Average", "Needs improvement"],
  },
  {
    title: "What did you like most?",
    subtitle: "Choose your favourite part.",
    options: ["Design", "Easy to use", "Features", "Everything"],
  },
  {
    title: "Would you recommend us?",
    subtitle: "Your opinion matters to us.",
    options: ["Definitely!", "Maybe", "Not sure", "No"],
  },
];

const steps = [
  {
    number: "01",
    title: "Create",
    description: "Design your form with our simple builder.",
  },
  {
    number: "02",
    title: "Share",
    description: "Publish and share your form anywhere.",
  },
  {
    number: "03",
    title: "Collect",
    description: "Collect responses and understand your audience.",
  },
];

function InteractiveDemo() {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const question = questions[current];
  const progress = submitted ? 100 : ((current + 1) / questions.length) * 100;

  function chooseAnswer(answer: string) {
    setAnswers((previous) => {
      const updated = [...previous];
      updated[current] = answer;
      return updated;
    });
  }

  function nextQuestion() {
    if (!answers[current]) return;

    if (current === questions.length - 1) {
      setSubmitted(true);
    } else {
      setCurrent((previous) => previous + 1);
    }
  }

  function restart() {
    setCurrent(0);
    setAnswers([]);
    setSubmitted(false);
  }

  return (
    <div className="w-full rounded-[22px] border border-[#e8e0d1] bg-white p-5 shadow-2xl shadow-[#77674b]/10 sm:p-7">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a18d68]">
            Live interactive demo
          </p>
          <h3 className="mt-1.5 text-lg font-bold">Customer Feedback</h3>
        </div>
        <span className="rounded-full bg-[#f4f0e7] px-3 py-1.5 text-[10px] font-semibold text-[#786b55]">
          Try it!
        </span>
      </div>

      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-[#eeeae2]">
        <motion.div
          className="h-full rounded-full bg-[#a18d68]"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-[#999184]">
        <span>
          {submitted ? "Completed" : `Question ${current + 1} of 3`}
        </span>
        <span>{Math.round(progress)}%</span>
      </div>

      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="py-12 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e9eee2] text-3xl text-[#71815c]">
              ✓
            </div>
            <h4 className="mt-5 text-xl font-bold">Thank you!</h4>
            <p className="mt-2 text-sm text-[#77746c]">
              Your demo response is complete.
            </p>
            <button
              onClick={restart}
              className="mt-6 rounded-full bg-[#302e29] px-6 py-3 text-xs font-semibold text-white transition hover:bg-[#51483e]"
            >
              Try Again
            </button>
          </motion.div>
        ) : (
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <h4 className="mt-7 text-base font-bold">{question.title}</h4>
            <p className="mt-1.5 text-xs text-[#888176]">
              {question.subtitle}
            </p>

            <div className="mt-5 space-y-2.5">
              {question.options.map((option) => {
                const selected = answers[current] === option;

                return (
                  <button
                    key={option}
                    onClick={() => chooseAnswer(option)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left text-xs transition duration-200 ${
                      selected
                        ? "border-[#a18d68] bg-[#f7f3e9] font-semibold text-[#51483e]"
                        : "border-[#eeeae2] text-[#77746c] hover:border-[#cfc6b1] hover:bg-[#faf9f5]"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                        selected
                          ? "border-[#8d7957] bg-[#8d7957]"
                          : "border-[#cfc6b1]"
                      }`}
                    >
                      {selected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>

            <button
              disabled={!answers[current]}
              onClick={nextQuestion}
              className="mt-6 w-full rounded-xl bg-[#302e29] py-3.5 text-xs font-semibold text-white transition hover:bg-[#51483e] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {current === questions.length - 1 ? "Submit Demo →" : "Continue →"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-5 text-center text-[10px] text-[#aaa397]">
        Sample demo only · Responses are not saved
      </p>
    </div>
  );
}

function FloatingPreview() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const smoothX = useSpring(x, { stiffness: 120, damping: 18 });
  const smoothY = useSpring(y, { stiffness: 120, damping: 18 });

  const rotateY = useTransform(smoothX, [-150, 150], [-8, 8]);
  const rotateX = useTransform(smoothY, [-150, 150], [8, -8]);

  return (
    <div
      className="relative mx-auto w-full max-w-[450px] [perspective:1000px]"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        x.set(event.clientX - rect.left - rect.width / 2);
        y.set(event.clientY - rect.top - rect.height / 2);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      <motion.div
        style={{ rotateX, rotateY }}
        animate={{ y: [0, -9, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="relative rounded-[25px] border border-[#e6dece] bg-white p-5 shadow-2xl shadow-[#77674b]/10 sm:p-7"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.17em] text-[#a18d68]">
              FormFlow Studio
            </p>
            <h3 className="mt-1.5 text-lg font-bold">Your New Form</h3>
          </div>
          <span className="rounded-lg bg-[#f1eee5] px-3 py-2 text-[10px] font-semibold text-[#786b55]">
            Draft
          </span>
        </div>

        <div className="mt-7 space-y-5">
          <div className="rounded-xl border border-dashed border-[#cfc6b1] bg-[#faf9f5] p-5">
            <p className="text-[10px] font-semibold text-[#a18d68]">
              QUESTION 01
            </p>
            <p className="mt-2 text-sm font-bold">
              What brings you here today?
            </p>
            <div className="mt-4 space-y-2">
              {["Personal project", "Business", "Education"].map((item, i) => (
                <div
                  key={item}
                  className={`rounded-lg border px-3 py-2.5 text-[11px] ${
                    i === 0
                      ? "border-[#b7a88b] bg-[#f2eee4]"
                      : "border-[#eeeae2] bg-white text-[#77746c]"
                  }`}
                >
                  ◯ {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#eeeae2] p-4">
            <p className="text-[10px] text-[#a18d68]">QUESTION 02</p>
            <p className="mt-2 text-xs font-semibold">
              Tell us a little about yourself
            </p>
            <div className="mt-3 rounded-lg border border-[#eeeae2] p-3 text-[10px] text-[#b5afa4]">
              Type your answer...
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-[10px] text-[#999184]">2 questions added</span>
          <span className="rounded-full bg-[#302e29] px-4 py-2 text-[10px] font-semibold text-white">
            Publish Form →
          </span>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, -8, 0], rotate: [0, 2, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-3 top-12 rounded-xl border border-[#e9e3d7] bg-white p-3 shadow-xl sm:-right-9"
      >
        <p className="text-[9px] text-[#999184]">Form responses</p>
        <p className="mt-1 text-lg font-bold">+128</p>
        <p className="text-[9px] text-[#81906c]">Growing steadily ↗</p>
      </motion.div>

      <motion.div
        animate={{ y: [0, 7, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-7 -left-3 rounded-xl border border-[#e9e3d7] bg-white px-4 py-3 shadow-xl sm:-left-9"
      >
        <p className="text-[10px] font-semibold">✦ Smart & Simple</p>
        <p className="mt-1 text-[9px] text-[#999184]">
          Create without limits
        </p>
      </motion.div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fffefa] text-[#302e29]">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#eeeae2] bg-[#fffefa]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#302e29] text-lg font-bold text-white">
              F
            </span>
            <span className="text-xl font-bold tracking-tight">
              FormFlow<span className="text-[#a18d68]">.</span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 text-xs font-medium text-[#77746c] md:flex">
            <a href="#features" className="hover:text-[#302e29]">Features</a>
            <a href="#how-it-works" className="hover:text-[#302e29]">How it works</a>
            <Link href="/explore" className="hover:text-[#302e29]">Explore</Link>
            <Link href="/pricing" className="hover:text-[#302e29]">
  Pricing
</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-xs font-semibold sm:block">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[#302e29] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#51483e]"
            >
              Get Started →
            </Link>
          </div>
        </div>
      </nav>

      <div className="h-[72px]" />
      {/* Hero */}
      <section className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 py-20 lg:grid-cols-2 lg:px-10 lg:py-24">
        <div className="pointer-events-none absolute -left-40 top-10 h-80 w-80 rounded-full bg-[#ebe2cc]/50 blur-[100px]" />

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[#ded6c1] bg-[#f7f3e9] px-3.5 py-2 text-[10px] font-semibold text-[#786b55]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#a18d68]" />
            A smarter way to collect responses
          </span>

          <h1 className="mt-7 max-w-xl text-[40px] font-bold leading-[1.13] tracking-tight sm:text-[48px] lg:text-[54px]">
            Forms that work.
            <span className="mt-1 block text-[#a18d68]">
              Experiences that flow.
            </span>
          </h1>

          <p className="mt-6 max-w-md text-sm leading-7 text-[#77746c]">
            Create beautiful forms, collect meaningful responses and
            understand your audience — all in one simple platform.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-[#302e29] px-6 py-3.5 text-xs font-semibold text-white shadow-lg shadow-[#302e29]/10 transition hover:-translate-y-1 hover:bg-[#51483e]"
            >
              Start Building for Free →
            </Link>
            <a
              href="#live-demo"
              className="rounded-full border border-[#d9d2c4] px-6 py-3.5 text-xs font-semibold transition hover:bg-[#f5f1e8]"
            >
              Try Interactive Demo
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-5 text-[11px] text-[#77746c]">
            <span>✓ Easy to use</span>
            <span>✓ Smart logic</span>
            <span>✓ Live insights</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 25 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="relative z-10"
        >
          <FloatingPreview />
        </motion.div>
      </section>

      {/* Feature strip */}
      <section className="border-y border-[#eeeae2] bg-[#faf8f2] px-6 py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-12 gap-y-3 text-center text-[11px] font-medium text-[#77746c]">
          <span>✦ Intuitive form building</span>
          <span>◇ Smart conditional logic</span>
          <span>▥ Organized analytics</span>
          <span>▤ Custom templates</span>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-[#f7f5ef] px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a18d68]">
              Everything you need
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              More than just a form builder.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#77746c]">
              Powerful tools to help you create, share and manage forms
              without unnecessary complexity.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                whileHover={{ y: -7, rotateX: 2, rotateY: -2 }}
                className="rounded-2xl border border-[#e9e3d7] bg-white p-6 shadow-sm transition-shadow hover:shadow-xl hover:shadow-[#6c5d43]/5"
                style={{ transformPerspective: 800 }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f2eee4] text-xl text-[#8d7957]">
                  {feature.icon}
                </span>
                <h3 className="mt-6 text-sm font-bold">{feature.title}</h3>
                <p className="mt-3 text-xs leading-6 text-[#77746c]">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo */}
      <section id="live-demo" className="px-6 py-20 lg:px-10">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a18d68]">
              Experience FormFlow
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              Don't just imagine it.
              <span className="block text-[#a18d68]">Try it yourself.</span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#77746c]">
              Explore a sample form right here. Select your answers,
              move through the questions and experience how simple
              collecting responses can feel.
            </p>

            <div className="mt-8 space-y-4">
              {[
                "Interactive question selection",
                "Animated progress indicator",
                "Instant completion experience",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-xs font-medium">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ebe2cc] text-[#786b55]">
                    ✓
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-[27px] bg-[#f7f5ef] p-3 sm:p-5"
          >
            <InteractiveDemo />
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-[#f7f5ef] px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a18d68]">
              Simple process
            </p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Three steps. Endless possibilities.
            </h2>
          </div>

          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.12 }}
                className="text-center"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ebe2cc] text-lg font-bold text-[#786b55]">
                  {step.number}
                </div>
                <h3 className="mt-5 text-base font-bold">{step.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-xs leading-6 text-[#77746c]">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section className="px-6 py-20 lg:px-10">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a18d68]">
              Ready-made templates
            </p>
            <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              Start with an idea.
              <span className="block text-[#a18d68]">Make it yours.</span>
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#77746c]">
              Explore customizable form ideas and create something
              that works perfectly for your needs.
            </p>
            <Link
              href="/explore"
              className="mt-7 inline-flex rounded-full bg-[#302e29] px-6 py-3.5 text-xs font-semibold text-white transition hover:bg-[#51483e]"
            >
              Explore Templates →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ["✦", "Customer Survey", "#ebe2cc"],
              ["▤", "Registration", "#e5ddd0"],
              ["♡", "Feedback Form", "#eee4df"],
              ["◇", "Quiz & Assessment", "#e7e6d9"],
            ].map(([icon, title, color], index) => (
              <motion.div
                key={title}
                whileHover={{ y: -5, rotate: index % 2 === 0 ? -1 : 1 }}
                className="rounded-2xl border border-[#e9e3d7] bg-white p-4 shadow-sm"
              >
                <div
                  style={{ backgroundColor: color }}
                  className="flex h-24 items-center justify-center rounded-xl text-3xl text-[#786b55]"
                >
                  {icon}
                </div>
                <p className="mt-3 text-xs font-bold">{title}</p>
                <p className="mt-1 text-[10px] text-[#999184]">
                  Ready to customize
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section id="pricing" className="bg-[#f7f5ef] px-6 py-20">
        <div className="mx-auto max-w-3xl rounded-[25px] border border-[#e9e3d7] bg-white px-7 py-12 text-center sm:px-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a18d68]">
            Flexible plans
          </p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            Plans that grow with you.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[#77746c]">
            Whether you're just getting started or building at scale,
            we're working towards the right plan for every creator.
          </p>
          <p className="mt-4 text-xs text-[#a18d68]">
  Plans starting at ₹0/month. Choose the right plan for you.
</p>
<Link
  href="/pricing"
  className="mt-7 inline-flex rounded-full bg-[#302e29] px-7 py-3.5 text-xs font-semibold text-white transition hover:bg-[#51483e]"
>
  Explore All Plans →
</Link>
          <Link
            href="/signup"
            className="mt-7 inline-flex rounded-full bg-[#302e29] px-7 py-3.5 text-xs font-semibold text-white transition hover:bg-[#51483e]"
          >
            Get Started Today →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl rounded-[27px] bg-[#302e29] px-7 py-14 text-center text-white sm:px-14">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7c7a6]">
            Your next great form starts here
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
            Ready to make forms feel effortless?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[#d0cbc1]">
            Bring your ideas to life. Create your first form with
            FormFlow and start collecting meaningful responses.
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
      <footer className="border-t border-[#eeeae2] px-6 py-9">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <Link href="/" className="text-lg font-bold">
              FormFlow<span className="text-[#a18d68]">.</span>
            </Link>
            <p className="mt-1 text-[11px] text-[#999184]">
              Create. Share. Collect. Simplified.
            </p>
          </div>

          <div className="flex flex-wrap gap-5 text-xs text-[#77746c]">
            <Link href="/explore">Explore</Link>
            <Link href="/login">Login</Link>
            <Link href="/signup">Sign Up</Link>
            <a href="#features">Features</a>
          </div>

          <p className="text-[10px] text-[#999184]">
            © 2026 FormFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
