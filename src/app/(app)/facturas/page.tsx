import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { ListaFacturas } from "@/features/facturas/components/ListaFacturas";

export const metadata: Metadata = {
  title: "Facturas | HogarFinance IA",
};

export default function FacturasPage() {
  return (
    <>
      <PageHeader
        title="Facturas"
        subtitle="Lo que tenés para pagar, ordenado por urgencia"
      />
      <ListaFacturas />
    </>
  );
}
