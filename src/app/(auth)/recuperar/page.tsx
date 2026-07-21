import type { Metadata } from "next";
import { RecuperarForm } from "@/features/auth/components/RecuperarForm";

export const metadata: Metadata = {
  title: "Recuperar contraseña | HogarFinance IA",
};

export default function RecuperarPage() {
  return <RecuperarForm />;
}
