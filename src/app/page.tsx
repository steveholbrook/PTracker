import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarRange,
  CircleDollarSign,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/common/button";

const capabilities = [
  {
    icon: BarChart3,
    title: "Financial control",
    copy: "Forecast, actuals, earned value and monthly reconciliation in one governed view.",
  },
  {
    icon: CalendarRange,
    title: "Delivery control",
    copy: "A purpose-built POAP with dependencies, critical path, baselines and automatic progress.",
  },
  {
    icon: CircleDollarSign,
    title: "Invoice control",
    copy: "Evidence-backed invoices, PO balances and locked actual periods with a full audit trail.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#07192f] text-white">
      <div className="subtle-grid min-h-screen">
        <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3 text-lg font-bold">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0e91a1] text-sm font-black">
              PT
            </span>
            PTracker
          </div>
          <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
            <Link href="/login">Sign in</Link>
          </Button>
        </header>
        <main>
          <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:pt-24">
            <div>
              <p className="mb-5 text-sm font-bold uppercase tracking-[0.22em] text-[#55d2dc]">
                Project controls, made decisive
              </p>
              <h1 className="max-w-4xl text-5xl font-bold leading-[1.06] tracking-[-0.045em] md:text-7xl">
                Know where the project stands—and what needs action.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#b9c8da]">
                PTracker brings financial performance, the delivery plan,
                actual effort, invoices and governance into one project-isolated
                workspace.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild variant="accent" size="lg">
                  <Link href="/login">
                    Open PTracker <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <div className="flex items-center gap-2 px-3 text-sm text-[#a9bbcf]">
                  <ShieldCheck className="h-5 w-5 text-[#55d2dc]" />
                  Firebase role security
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-3 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="rounded-2xl bg-[#f5f7fa] p-5 text-[#172033]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#0e91a1]">
                      Executive control
                    </p>
                    <p className="mt-1 text-lg font-bold">Portfolio snapshot</p>
                  </div>
                  <span className="rounded-full bg-[#def4eb] px-3 py-1 text-xs font-bold text-[#127453]">
                    Connected
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    ["BAC", "$883k"],
                    ["EAC", "$781k"],
                    ["Progress", "37%"],
                    ["Variance", "+$102k"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-[#e0e7ef] bg-white p-4"
                    >
                      <p className="text-xs font-semibold text-[#758397]">
                        {label}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-[#0b1f3a]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-xl bg-[#0b1f3a] p-4 text-white">
                  <div className="flex items-end gap-2">
                    {[36, 44, 40, 55, 62, 67, 76, 72, 86, 92].map(
                      (height, index) => (
                        <span
                          key={index}
                          className="flex-1 rounded-t bg-[#34b7c3]"
                          style={{ height }}
                        />
                      ),
                    )}
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-white/60">
                    <span>Forecast</span>
                    <span>Actuals to date</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section className="border-t border-white/10 bg-white/[0.03]">
            <div className="mx-auto grid max-w-7xl gap-4 px-6 py-14 md:grid-cols-3">
              {capabilities.map(({ icon: Icon, title, copy }) => (
                <div key={title} className="rounded-2xl border border-white/10 p-6">
                  <Icon className="h-6 w-6 text-[#55d2dc]" />
                  <h2 className="mt-4 text-lg font-bold">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#aebdd0]">{copy}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

