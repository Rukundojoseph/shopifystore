import Link from "next/link";
import { ArrowRight, Check, LayoutTemplate, MousePointerClick, Package, Smartphone, ShieldCheck, Globe } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { LinkButton, Logo } from "@/components/ui";

const STEPS = [
  { icon: LayoutTemplate, title: "Pick a template", text: "Designs made for fashion, electronics, beauty, groceries, furniture and more." },
  { icon: MousePointerClick, title: "Drag, drop, done", text: "Change colours, fonts, images and sections visually. No code." },
  { icon: Package, title: "Add your products", text: "Prices in RWF, sizes and colours, stock that updates itself." },
  { icon: Smartphone, title: "Get paid with MoMo", text: "Customers approve payment on their phone. Orders land in your dashboard." },
];

export default async function Home() {
  const [user, plans] = await Promise.all([getCurrentUser(), db.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { position: "asc" } })]);
  return (
    <div className="bg-white">
      <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2">
            <a href="#pricing" className="hidden px-3 text-sm text-zinc-600 hover:text-zinc-900 sm:block">Pricing</a>
            {user ? <LinkButton href="/dashboard">Dashboard</LinkButton> : <><LinkButton href="/login" variant="ghost">Sign in</LinkButton><LinkButton href="/register">Start free</LinkButton></>}
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(16,163,108,0.12),transparent_60%)]" />
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">🇷🇼 Made for Rwandan businesses</p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl">Your shop, online, <span className="text-brand-600">this afternoon.</span></h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600">Build a professional online store without code. Sell in RWF, take MTN Mobile Money payments, and manage orders from your phone.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <LinkButton href={user ? "/dashboard" : "/register"} size="lg">Create your free store <ArrowRight className="h-4 w-4" /></LinkButton>
            <LinkButton href="/s/kigalifashion" size="lg" variant="outline">See a demo store</LinkButton>
          </div>
          <p className="mt-4 text-sm text-zinc-500">Free plan · No credit card · Your own <b>yourstore.storehub.rw</b> address</p>
        </div>
      </section>

      <section className="border-y border-zinc-100 bg-zinc-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm ring-1 ring-zinc-200"><s.icon className="h-5 w-5" /></span>
              <p className="mt-4 text-xs font-semibold text-zinc-400">STEP {i + 1}</p>
              <h3 className="mt-1 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-3">
        {[
          { icon: Smartphone, title: "Mobile-first everything", text: "Most of your customers shop on their phones — every store is fast and responsive by default." },
          { icon: ShieldCheck, title: "Payments you can trust", text: "Orders are only marked paid after MTN confirms the transaction. No guesswork." },
          { icon: Globe, title: "Your brand, your domain", text: "Start on a free subdomain and connect your own .rw domain when you're ready." },
        ].map((f) => (
          <div key={f.title} className="flex gap-4">
            <f.icon className="h-6 w-6 shrink-0 text-brand-600" />
            <div><h3 className="font-semibold">{f.title}</h3><p className="mt-1 text-sm text-zinc-600">{f.text}</p></div>
          </div>
        ))}
      </section>

      <section id="pricing" className="bg-zinc-950 py-20 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold">Simple plans that grow with you</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {plans.map((p) => (
              <div key={p.id} className={`flex flex-col rounded-2xl p-6 ${p.key === "business" ? "bg-white text-zinc-900" : "bg-white/5 ring-1 ring-white/10"}`}>
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className={`mt-1 text-sm ${p.key === "business" ? "text-zinc-500" : "text-zinc-400"}`}>{p.description}</p>
                <p className="mt-4 text-3xl font-bold">{p.priceMonthly ? formatMoney(p.priceMonthly) : "Free"}{p.priceMonthly > 0 && <span className="text-sm font-normal opacity-60"> /month</span>}</p>
                <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />{f}</li>)}</ul>
                <Link href="/register" className={`mt-6 rounded-lg py-2.5 text-center text-sm font-semibold ${p.key === "business" ? "bg-brand-600 text-white" : "bg-white text-zinc-900"}`}>Get started</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} StoreHub Rwanda · Kigali</span>
          <nav className="flex gap-4"><Link href="/legal/privacy">Privacy</Link><Link href="/legal/terms">Terms</Link><Link href="/legal/cookies">Cookies</Link></nav>
        </div>
      </footer>
    </div>
  );
}
