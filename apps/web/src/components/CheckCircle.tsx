type Props = { checked: boolean };

export function CheckCircle({ checked }: Props) {
  return (
    <div
      className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-2 ${
        checked ? "border-primary bg-primary" : "border-border bg-transparent"
      }`}
    >
      {checked && (
        <span className="text-[11px] font-bold leading-none text-primary-foreground">✓</span>
      )}
    </div>
  );
}
