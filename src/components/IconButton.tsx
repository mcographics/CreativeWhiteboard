import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}

export function IconButton({ icon: Icon, label, active, className = "", ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "is-active" : ""} ${className}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      {...props}
    >
      <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
