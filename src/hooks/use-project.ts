"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { emptyWorkspace } from "@/state/demo-data";
import { useAppStore } from "@/state/app-store";

export function useProject(projectId: string) {
  const { user } = useAuth();
  const project = useAppStore((state) =>
    state.projects.find((item) => item.id === projectId),
  );
  const workspace = useAppStore(
    (state) => state.workspaces[projectId] ?? emptyWorkspace,
  );
  const member = useMemo(
    () =>
      workspace.members.find((item) => item.userId === user?.uid) ??
      workspace.members[0],
    [user?.uid, workspace.members],
  );
  return { project, workspace, role: member?.role, member };
}

