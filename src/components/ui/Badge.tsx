import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-lavender",
        className
      )}
    >
      {children}
    </span>
  );
}
