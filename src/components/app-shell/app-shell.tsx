"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarRange,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/common/badge";
import { useProject } from "@/hooks/use-project";
import { useAppStore } from "@/state/app-store";
import { cn } from "@/utils/cn";

const modules = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "poap", label: "POAP", icon: CalendarRange },
  { key: "forecast", label: "Forecast", icon: BarChart3 },
  { key: "actuals", label: "Actuals", icon: ClipboardList },
  { key: "invoices", label: "Invoices", icon: CircleDollarSign },
  { key: "reports", label: "Reports", icon: FileBarChart },
  { key: "admin", label: "Administration", icon: Settings },
] as const;

export function AppShell({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const projects = useAppStore((state) => state.projects);
  const { project, role } = useProject(projectId);
  const { user, signOut } = useAuth();
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const currentModule =
    modules.find((module) => pathname.includes(`/${module.key}`))?.key ??
    "dashboard";

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#f3f6fa]">
        <header className="no-print sticky top-0 z-50 border-b border-white/10 bg-[#0b1f3a] text-white shadow-lg shadow-[#0b1f3a]/10">
          <div className="flex h-16 items-center gap-4 px-4 md:px-6">
            <Link href="/projects" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0e91a1] text-sm font-black shadow-inner">
                PT
              </span>
              <span className="hidden text-base font-bold tracking-tight sm:inline">
                PTracker
              </span>
            </Link>
            <div className="h-7 w-px bg-white/20" />
            <label className="relative max-w-72 flex-1">
              <span className="sr-only">Selected project</span>
              <select
                value={projectId}
                onChange={(event) =>
                  router.push(
                    `/projects/${event.target.value}/${currentModule}`,
                  )
                }
                className="h-10 w-full appearance-none rounded-lg border border-white/15 bg-white/10 px-3 pr-9 text-sm font-semibold text-white outline-none focus:border-[#4ed0db]"
              >
                {projects
                  .filter((item) => !item.archived)
                  .map((item) => (
                    <option key={item.id} value={item.id} className="text-black">
                      {item.name}
                    </option>
                  ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-white/70" />
            </label>
            {user?.isDemo ? <Badge tone="warning">Demo workspace</Badge> : null}
            {!online ? <Badge tone="danger">Offline</Badge> : null}
            <div className="ml-auto hidden text-right lg:block">
              <p className="text-sm font-semibold">{user?.displayName}</p>
              <p className="text-xs text-white/60">
                {role?.replaceAll("_", " ") ?? "No project role"}
              </p>
            </div>
            <button
              aria-label="Sign out"
              onClick={() => void signOut().then(() => router.push("/login"))}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="mx-auto flex max-w-[1800px]">
          <aside className="no-print sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-[#dce4ed] bg-white px-3 py-5 lg:block">
            <div className="mb-5 px-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8793a5]">
                Project
              </p>
              <p className="mt-1 truncate text-sm font-bold text-[#172033]">
                {project?.code}
              </p>
            </div>
            <nav className="space-y-1">
              {modules.map(({ key, label, icon: Icon }) => {
                const active = currentModule === key;
                return (
                  <Link
                    key={key}
                    href={`/projects/${projectId}/${key}`}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                      active
                        ? "bg-[#e5f2f5] text-[#087684]"
                        : "text-[#5a6980] hover:bg-[#f1f5f9] hover:text-[#172033]",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="absolute bottom-5 left-3 right-3 rounded-xl border border-[#dce6ef] bg-[#f6f9fb] p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#526177]">
                <ShieldCheck className="h-4 w-4 text-[#16875f]" />
                Project-isolated access
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-[#7a8799]">
                <Users className="h-4 w-4" />
                {project ? "Membership enforced" : "Project unavailable"}
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <nav className="no-print flex gap-1 overflow-x-auto border-b border-[#dce4ed] bg-white px-3 py-2 lg:hidden">
              {modules.map(({ key, label, icon: Icon }) => (
                <Link
                  key={key}
                  href={`/projects/${projectId}/${key}`}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold",
                    currentModule === key
                      ? "bg-[#e5f2f5] text-[#087684]"
                      : "text-[#5a6980]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
            <main className="p-4 md:p-6 xl:p-8">{children}</main>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
