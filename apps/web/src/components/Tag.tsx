import type { ReactNode } from "react";

type Props = { children: ReactNode };

export function Tag({ children }: Props) {
  return (
    <span className="rounded-full bg-primary/10 px-[9px] py-[3px] text-[10px] font-bold uppercase tracking-wider text-primary">
      {children}
    </span>
  );
}
