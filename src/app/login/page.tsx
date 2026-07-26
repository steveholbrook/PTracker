"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LogIn, ShieldCheck, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/common/button";
import { Card, CardContent } from "@/components/common/card";
import { Input, Label } from "@/components/common/field";
import {
  loginWithEmail,
  loginWithGoogle,
  loginWithMicrosoft,
} from "@/firebase/auth";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(6, "Password must contain at least six characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, firebaseConfigured, enterDemo } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!loading && user) router.replace("/projects");
  }, [loading, router, user]);

  async function submit(values: LoginValues) {
    setSubmitting(true);
    try {
      await loginWithEmail(values.email, values.password);
      router.push("/projects");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  function startDemo(persona: "ADMIN" | "CUSTOMER_VIEWER") {
    enterDemo(persona);
    router.push("/projects");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edf2f7] p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[#d8e1eb] bg-white shadow-2xl shadow-[#0b1f3a]/10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="subtle-grid hidden bg-[#0b1f3a] p-10 text-white lg:flex lg:flex-col">
          <Link href="/" className="flex items-center gap-2 text-sm text-white/70">
            <ArrowLeft className="h-4 w-4" />
            PTracker home
          </Link>
          <div className="my-auto">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0e91a1] text-base font-black">
              PT
            </span>
            <h1 className="mt-7 text-4xl font-bold tracking-tight">
              One trusted view of delivery and financial performance.
            </h1>
            <p className="mt-5 text-sm leading-7 text-[#bdcadd]">
              Project membership, rates, customer-safe reporting and every
              mutation are governed through Firebase Authentication and
              project-scoped security rules.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <ShieldCheck className="h-4 w-4 text-[#55d2dc]" />
            Enterprise role model and append-only audit
          </div>
        </section>
        <section className="p-6 sm:p-10 lg:p-12">
          <div className="mx-auto max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0e91a1]">
              Secure access
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#0b1f3a]">
              Sign in to PTracker
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#68778c]">
              Use your approved organisation account. Your role determines
              exactly what you can see and change.
            </p>

            {firebaseConfigured ? (
              <>
                <form onSubmit={handleSubmit(submit)} className="mt-7 space-y-4">
                  <div>
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      {...register("email")}
                    />
                    {errors.email ? (
                      <p className="mt-1 text-xs text-[#c43d4f]">
                        {errors.email.message}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      {...register("password")}
                    />
                    {errors.password ? (
                      <p className="mt-1 text-xs text-[#c43d4f]">
                        {errors.password.message}
                      </p>
                    ) : null}
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    <LogIn className="h-4 w-4" />
                    {submitting ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
                <div className="my-5 flex items-center gap-3 text-xs text-[#8a96a7]">
                  <span className="h-px flex-1 bg-[#e0e7ef]" />
                  Or continue with
                  <span className="h-px flex-1 bg-[#e0e7ef]" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      void loginWithGoogle().catch((error: Error) =>
                        toast.error(error.message),
                      )
                    }
                  >
                    Google
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      void loginWithMicrosoft().catch((error: Error) =>
                        toast.error(error.message),
                      )
                    }
                  >
                    Microsoft
                  </Button>
                </div>
              </>
            ) : (
              <Card className="mt-7 border-[#cde7ea] bg-[#f1fafb] shadow-none">
                <CardContent>
                  <p className="text-sm font-bold text-[#086f79]">
                    Firebase setup is the next deployment step
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#527078]">
                    The app is running safely in a local demonstration
                    workspace because Firebase environment variables have not
                    been added yet.
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="mt-6 grid gap-2">
              <Button variant="accent" onClick={() => startDemo("ADMIN")}>
                <Users className="h-4 w-4" />
                Explore as Administrator
              </Button>
              <Button
                variant="outline"
                onClick={() => startDemo("CUSTOMER_VIEWER")}
              >
                Explore customer-safe view
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

