export function BasketLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <path
        d="M9 12C9 12 9.5 6 13 6C16.5 6 17 12 17 12"
        stroke="hsl(var(--primary))"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M4 12h18l-1.8 11.5H5.8L4 12z"
        fill="hsl(var(--primary) / 0.1)"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <line
        x1="10"
        y1="14"
        x2="9.3"
        y2="22"
        stroke="hsl(var(--secondary-foreground))"
        strokeWidth="0.8"
        opacity="0.6"
      />
      <line
        x1="13"
        y1="14"
        x2="13"
        y2="23"
        stroke="hsl(var(--secondary-foreground))"
        strokeWidth="0.8"
        opacity="0.6"
      />
      <line
        x1="16"
        y1="14"
        x2="16.7"
        y2="22"
        stroke="hsl(var(--secondary-foreground))"
        strokeWidth="0.8"
        opacity="0.6"
      />
    </svg>
  );
}

export function ReceiptIcon() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="16"
        height="20"
        rx="2"
        stroke="hsl(var(--primary))"
        strokeWidth="1.4"
      />
      <line
        x1="4"
        y1="6.5"
        x2="14"
        y2="6.5"
        stroke="hsl(var(--primary))"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.55"
      />
      <line
        x1="4"
        y1="10"
        x2="14"
        y2="10"
        stroke="hsl(var(--primary))"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.55"
      />
      <line
        x1="4"
        y1="13.5"
        x2="10"
        y2="13.5"
        stroke="hsl(var(--primary))"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="4" stroke="hsl(var(--muted-foreground))" strokeWidth="1.3" />
      <line
        x1="9"
        y1="9"
        x2="12"
        y2="12"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
