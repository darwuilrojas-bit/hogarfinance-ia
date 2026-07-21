"use client";

import { useId } from "react";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: React.ReactNode;
  error?: string;
};

export function Select({
  label,
  error,
  children,
  className = "",
  ...props
}: SelectProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={id}
        className={`h-12 appearance-none rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${
          error ? "border-red-400" : ""
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
