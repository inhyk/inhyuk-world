import Link from "next/link";
import { cn } from "@/lib/utils";

interface ButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
  external?: boolean;
  className?: string;
}

export function Button({
  href,
  children,
  variant = "primary",
  external = false,
  className,
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-medium transition-all duration-300";
  const variants = {
    primary:
      "bg-accent text-background hover:bg-accent-hover hover:scale-[1.03] hover:shadow-lg",
    outline:
      "border border-foreground/15 text-foreground hover:bg-foreground/5 hover:scale-[1.03]",
  };

  const props = external
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  return (
    <Link
      href={href}
      className={cn(baseStyles, variants[variant], className)}
      {...props}
    >
      {children}
    </Link>
  );
}
