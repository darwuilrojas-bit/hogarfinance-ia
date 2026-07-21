import type { Metadata } from "next";
import { RestablecerForm } from "@/features/auth/components/RestablecerForm";

export const metadata: Metadata = {
  title: "Elegir nueva contraseña | HogarFinance IA",
};

export default function RestablecerPage() {
  return <RestablecerForm />;
}
