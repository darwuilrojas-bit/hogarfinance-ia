import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResumenReportes } from "@/features/reportes/components/ResumenReportes";

export const metadata: Metadata = {
  title: "Reportes | HogarFinance IA",
};

export default function ReportesPage() {
  return (
    <>
      <PageHeader
        title="Reportes"
        subtitle="Análisis de tus gastos por período y categoría"
      />
      <ResumenReportes />
    </>
  );
}
