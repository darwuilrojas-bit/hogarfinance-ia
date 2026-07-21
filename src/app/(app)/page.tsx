import { Suspense } from "react";
import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader";
import { ResumenMes } from "@/features/dashboard/components/ResumenMes";
import { ProximosVencimientos } from "@/features/dashboard/components/ProximosVencimientos";
import { GraficoCategorias } from "@/features/dashboard/components/GraficoCategorias";
import { AccesosRapidos } from "@/features/dashboard/components/AccesosRapidos";
import { MensajeExito } from "@/features/dashboard/components/MensajeExito";

export default function InicioPage() {
  return (
    <>
      <Suspense>
        <MensajeExito />
      </Suspense>
      <DashboardHeader />
      <div className="flex flex-col gap-5 px-5 py-5">
        <ResumenMes />
        <ProximosVencimientos />
        <GraficoCategorias />
        <AccesosRapidos />
      </div>
    </>
  );
}
