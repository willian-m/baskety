type Props = { expiresAt: string | null };

const MS_IN_DAY = 86_400_000;

export function ExpiryBadge({ expiresAt }: Props) {
  if (!expiresAt) return null;
  const daysLeft = Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / MS_IN_DAY,
  );
  if (daysLeft > 7) return null;
  const label =
    daysLeft <= 0 ? "Expired" : daysLeft === 1 ? "1 day" : `${daysLeft} days`;
  const color =
    daysLeft <= 0
      ? "bg-destructive/10 text-destructive"
      : daysLeft <= 2
        ? "bg-orange-100 text-orange-700"
        : "bg-yellow-100 text-yellow-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {label}
    </span>
  );
}
