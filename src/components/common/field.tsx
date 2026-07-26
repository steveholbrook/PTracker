import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/utils/cn";

export function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#596a82]"
    >
      {children}
    </label>
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-[#cbd6e2] bg-white px-3 text-sm text-[#172033] outline-none transition focus:border-[#0e91a1] focus:ring-2 focus:ring-[#0e91a1]/15 disabled:bg-[#eef2f6]",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg border border-[#cbd6e2] bg-white px-3 text-sm text-[#172033] outline-none transition focus:border-[#0e91a1] focus:ring-2 focus:ring-[#0e91a1]/15 disabled:bg-[#eef2f6]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-lg border border-[#cbd6e2] bg-white px-3 py-2 text-sm text-[#172033] outline-none transition focus:border-[#0e91a1] focus:ring-2 focus:ring-[#0e91a1]/15",
        className,
      )}
      {...props}
    />
  );
}

