import type { Metadata } from "next";
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
        <div className="mt-2 flex flex-col gap-2">
          <LogoutButton />
          <EliminarCuenta />
        </div>
      </div>
    </>
  );
}
