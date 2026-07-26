import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[#c9d4e1] bg-[#f8fafc] p-8 text-center">
      <div className="mb-4 rounded-xl bg-[#e8eff7] p-3 text-[#34577e]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-[#172033]">{title}</h3>
      <p className="mt-2 max-w-lg text-sm leading-6 text-[#68778c]">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

