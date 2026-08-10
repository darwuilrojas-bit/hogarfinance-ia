import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfigAlertas } from "@/features/auth/components/ConfigAlertas";
import { DatosPrueba } from "@/features/auth/components/DatosPrueba";
import { EliminarCuenta } from "@/features/auth/components/EliminarCuenta";
import { EstadisticasPersonales } from "@/features/auth/components/EstadisticasPersonales";
import { LogoutButton } from "@/features/auth/components/LogoutButton";
import { PerfilForm } from "@/features/auth/components/PerfilForm";
import { ServiciosRecurrentes } from "@/features/auth/components/ServiciosRecurrentes";

export const metadata: Metadata = {
  title: "Perfil | HogarFinance IA",
};

export default function PerfilPage() {
  return (
    <>
      <PageHeader title="Perfil" subtitle="Tu cuenta y configuración" />
      <div className="flex flex-col gap-4 px-5 py-5">
        <PerfilForm />
        <ConfigAlertas />
        <ServiciosRecurrentes />
        <EstadisticasPersonales />
        <DatosPrueba />
        <Link
          href="/ayuda"
          className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm active:bg-gray-50"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light text-primary">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
                />
              </svg>
            </span>
            <span className="text-sm font-semibold text-gray-900">Ayuda</span>
          </span>
          <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
        <div className="mt-2 flex flex-col gap-2">
          <LogoutButton />
          <EliminarCuenta />
        </div>
      </div>
    </>
  );
}
