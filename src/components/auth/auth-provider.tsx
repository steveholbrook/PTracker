"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseConfigured } from "@/firebase/client";
import { getFirebaseAuth, logoutFirebase } from "@/firebase/auth";
import { loadUserSystemRole } from "@/firebase/firestore";
import { useAppStore } from "@/state/app-store";
import type { SessionUser } from "@/types/domain";

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  firebaseConfigured: boolean;
  enterDemo: (persona?: "ADMIN" | "CUSTOMER_VIEWER") => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshFromFirebase = useAppStore(
    (state) => state.refreshFromFirebase,
  );

  useEffect(() => {
    void useAppStore.persist.rehydrate();
    const demo = window.localStorage.getItem("ptracker-demo-session");
    if (demo) {
      queueMicrotask(() => {
        setUser(JSON.parse(demo) as SessionUser);
        setLoading(false);
      });
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      void loadUserSystemRole(firebaseUser.uid)
        .catch(() => undefined)
        .then((systemRole) => {
          const nextUser: SessionUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? "",
            displayName:
              firebaseUser.displayName ??
              firebaseUser.email?.split("@")[0] ??
              "User",
            isDemo: false,
            systemRole,
          };
          setUser(nextUser);
          setLoading(false);
          void refreshFromFirebase(nextUser.uid);
        });
    });
  }, [refreshFromFirebase]);

  const enterDemo = useCallback(
    (persona: "ADMIN" | "CUSTOMER_VIEWER" = "ADMIN") => {
      const nextUser: SessionUser =
        persona === "CUSTOMER_VIEWER"
          ? {
              uid: "demo-viewer",
              email: "viewer@demo.invalid",
              displayName: "Customer Viewer",
              isDemo: true,
            }
          : {
              uid: "demo-admin",
              email: "admin@demo.invalid",
              displayName: "Demo Administrator",
              isDemo: true,
              systemRole: "ADMIN",
            };
      window.localStorage.setItem(
        "ptracker-demo-session",
        JSON.stringify(nextUser),
      );
      setUser(nextUser);
    },
    [],
  );

  const signOut = useCallback(async () => {
    window.localStorage.removeItem("ptracker-demo-session");
    await logoutFirebase();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      firebaseConfigured,
      enterDemo,
      signOut,
    }),
    [enterDemo, loading, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
