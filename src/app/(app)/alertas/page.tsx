import type { Metadata } from "next";
import Link from "next/link";
import { PanelAlertas } from "@/features/alertas/components/PanelAlertas";

export const metadata: Metadata = {
  title: "Notificaciones | HogarFinance IA",
};

export default function AlertasPage() {
  return (
    <>
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-gray-100 bg-white/95 px-4 pb-3 pt-5 backdrop-blur">
        <Link
          href="/"
          aria-label="Volver al inicio"
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 active:bg-gray-100"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Notificaciones
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Alertas de vencimientos, montos y presupuesto
          </p>
        </div>
      </header>
      <PanelAlertas />
    </>
  );
}
