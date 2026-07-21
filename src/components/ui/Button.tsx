"use client";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
};

const VARIANTES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-primary text-white active:bg-primary-dark disabled:bg-primary/50",
  secondary:
    "bg-secondary text-white active:bg-secondary-dark disabled:bg-secondary/50",
  ghost:
    "bg-transparent text-primary active:bg-primary-light disabled:text-primary/50",
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition-colors ${VARIANTES[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden
        />
      ) : null}
      {children}
    </button>
  );
}
