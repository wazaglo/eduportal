import { component$ } from "@builder.io/qwik";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

export interface BadgeProps {
  variant?: BadgeVariant;
  class?: string;
  children?: any;
}

export const Badge = component$<BadgeProps>(({ variant = "default", class: className, children }) => {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-surface-tertiary text-text-secondary",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    info: "bg-accent-100 text-accent-700 dark:bg-accent-700/30 dark:text-accent-400",
  };

  return (
    <span
      class={[
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
});
