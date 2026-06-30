import type { ReactNode } from "react";

type Props = { title: string; subtitle?: string; action?: ReactNode };

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-[28px] font-semibold leading-tight tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
