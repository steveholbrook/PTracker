"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FolderKanban,
  LogOut,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/button";
import { Card, CardContent } from "@/components/common/card";
import { Input, Label, Textarea } from "@/components/common/field";
import { useAppStore } from "@/state/app-store";
import type { Project } from "@/types/domain";

export default function ProjectsPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const projects = useAppStore((state) => state.projects);
  const createProject = useAppStore((state) => state.createProject);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  function submitProject(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !name.trim() || !code.trim()) return;
    const project: Project = {
      id: `${code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomUUID().slice(0, 6)}`,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim(),
      archived: false,
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
    };
    createProject(project, user);
    router.push(`/projects/${project.id}/dashboard`);
  }

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#f3f6fa]">
        <header className="border-b border-white/10 bg-[#0b1f3a] text-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center px-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0e91a1] text-sm font-black">
              PT
            </span>
            <span className="ml-3 font-bold">PTracker</span>
            <div className="ml-auto text-right">
              <p className="text-sm font-semibold">{user?.displayName}</p>
              <p className="text-xs text-white/60">{user?.email}</p>
            </div>
            <button
              onClick={() => void signOut().then(() => router.push("/login"))}
              className="ml-4 rounded-lg p-2 text-white/70 hover:bg-white/10"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-5 py-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0e91a1]">
                Your workspaces
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0b1f3a]">
                Select a project
              </h1>
              <p className="mt-2 text-sm text-[#68778c]">
                You only see projects where your membership is active.
              </p>
            </div>
            {user?.systemRole === "ADMIN" ? (
              <Button
                variant="accent"
                onClick={() => setShowCreate((value) => !value)}
              >
                <Plus className="h-4 w-4" />
                Create project
              </Button>
            ) : null}
          </div>

          {showCreate ? (
            <Card className="mt-6 border-[#b9dfe3]">
              <CardContent>
                <form
                  onSubmit={submitProject}
                  className="grid gap-4 md:grid-cols-[1fr_180px_1.4fr_auto] md:items-end"
                >
                  <div>
                    <Label htmlFor="project-name">Project name</Label>
                    <Input
                      id="project-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="project-code">Short code</Label>
                    <Input
                      id="project-code"
                      value={code}
                      maxLength={12}
                      onChange={(event) => setCode(event.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="project-description">Description</Label>
                    <Textarea
                      id="project-description"
                      className="min-h-10"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </div>
                  <Button type="submit">Create</Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects
              .filter((project) => !project.archived)
              .map((project) => (
                <Card
                  key={project.id}
                  className="group transition hover:-translate-y-0.5 hover:border-[#a8ccd2] hover:shadow-lg"
                >
                  <CardContent>
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-xl bg-[#e7f0f8] p-3 text-[#285986]">
                        <FolderKanban className="h-6 w-6" />
                      </span>
                      <Badge tone="success">Active</Badge>
                    </div>
                    <p className="mt-5 text-xs font-bold uppercase tracking-[0.13em] text-[#0e91a1]">
                      {project.code}
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-[#172033]">
                      {project.name}
                    </h2>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-[#68778c]">
                      {project.description || "Project controls workspace"}
                    </p>
                    <Button
                      variant="ghost"
                      className="mt-4 -ml-3 text-[#0b7280]"
                      onClick={() =>
                        router.push(`/projects/${project.id}/dashboard`)
                      }
                    >
                      Open workspace
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
          </div>

          <div className="mt-8 flex items-center gap-2 text-xs text-[#7b8798]">
            <ShieldCheck className="h-4 w-4 text-[#16875f]" />
            Firestore security rules verify project membership on every read and
            write.
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
