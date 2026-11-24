import Image from "next/image";

export default function Home() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(155,77,255,0.22)_0%,_transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.05)_0%,_transparent_40%)]"
      />
      <div
        aria-hidden
        className="animate-spin-slow pointer-events-none absolute left-1/2 top-[38%] h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/15 sm:h-[36rem] sm:w-[36rem]"
      />
      <div
        aria-hidden
        className="animate-soft-pulse pointer-events-none absolute left-1/2 top-[38%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/25 blur-3xl sm:h-80 sm:w-80"
      />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="animate-fade-up flex flex-col items-center">
          <Image
            src="/digimandal-logo.png"
            alt="DigiMandal"
            width={280}
            height={280}
            priority
            className="h-auto w-44 drop-shadow-[0_0_40px_rgba(155,77,255,0.35)] sm:w-56 md:w-64"
          />
        </div>

        <h1 className="animate-fade-up-delay mt-10 max-w-xl font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
          One circle. Connected communities.
        </h1>

        <p className="animate-fade-up-delay-2 mt-5 max-w-md text-base leading-relaxed text-muted sm:text-lg">
          DigiMandal brings people, places, and purpose together in a simple
          digital space.
        </p>

        <div className="animate-fade-up-delay-2 mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <a
            href="#about"
            className="inline-flex h-12 min-w-[10.5rem] items-center justify-center rounded-md bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Get started
          </a>
          <a
            href="#contact"
            className="inline-flex h-12 min-w-[10.5rem] items-center justify-center rounded-md border border-white/15 px-6 text-sm font-semibold text-white transition hover:border-white/35 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
          >
            Contact us
          </a>
        </div>
      </main>

      <section
        id="about"
        className="relative z-10 border-t border-white/8 px-6 py-20"
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Built for modern mandals
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            From community updates to shared activities, DigiMandal helps your
            group stay organized, informed, and connected — without the clutter.
          </p>
        </div>
      </section>

      <section
        id="contact"
        className="relative z-10 border-t border-white/8 px-6 py-20"
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Let&apos;s connect
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            Ready to bring DigiMandal to your community? Reach out and we&apos;ll
            help you get started.
          </p>
          <a
            href="mailto:hello@digimandal.com"
            className="mt-8 inline-flex text-brand-soft transition hover:text-white"
          >
            hello@digimandal.com
          </a>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/8 px-6 py-8 text-center text-sm text-muted">
        © 2026 DigiMandal. All rights reserved.
      </footer>
    </div>
  );
}
