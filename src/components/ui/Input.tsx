"use client";

import { useId } from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: React.ReactNode;
  error?: string;
};

export function Input({ label, error, className = "", ...props }: InputProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        className={`h-12 rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20 ${
          error ? "border-red-400" : ""
        } ${className}`}
        {...props}
      />
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
