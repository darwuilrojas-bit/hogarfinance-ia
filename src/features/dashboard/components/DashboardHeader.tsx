"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * Encabezado del dashboard: marca de la app y campana de
 * notificaciones con la cantidad de alertas no leídas.
 */
export function DashboardHeader() {
  const [noLeidas, setNoLeidas] = useState(0);

  useEffect(() => {
    function cargar() {
      const supabase = createClient();
      supabase
        .from("alertas")
        .select("id", { count: "exact", head: true })
        .eq("leida", false)
        .then(({ count }) => setNoLeidas(count ?? 0));
    }
    cargar();
    // El motor de alertas avisa cuando genera notificaciones nuevas
    window.addEventListener("alertas-actualizadas", cargar);
    return () => window.removeEventListener("alertas-actualizadas", cargar);
  }, []);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-100 bg-white/95 px-5 py-3.5 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 12 11.2 3.05a1.125 1.125 0 0 1 1.59 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
            />
          </svg>
        </div>
        <span className="text-lg font-bold tracking-tight text-gray-900">
          HogarFinance <span className="text-primary">IA</span>
        </span>
      </div>

      <Link
        href="/alertas"
        aria-label={`Notificaciones: ${noLeidas} alertas sin leer`}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors active:bg-gray-100"
      >
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {noLeidas > 0 ? (
          <span className="absolute right-1 top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        ) : null}
      </Link>
    </header>
  );
}
