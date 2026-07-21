import type { Metadata } from "next";
import Link from "next/link";
import { ListaGastos } from "@/features/gastos/components/ListaGastos";

export const metadata: Metadata = {
  title: "Gastos | HogarFinance IA",
};

export default function GastosPage() {
  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-100 bg-white/95 px-5 pb-3 pt-5 backdrop-blur">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Gastos
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Historial de pagos del hogar, mes a mes
          </p>
        </div>
        <Link
          href="/comprobantes/nuevo"
          aria-label="Registrar pago"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white active:bg-primary-dark"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </Link>
      </div>
      <ListaGastos />
    </>
  );
}
