import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { SupabaseWarning } from "@/features/auth/components/SupabaseWarning";

export const metadata: Metadata = {
  title: "Crear cuenta | HogarFinance IA",
};

export default function RegistroPage() {
  return (
    <div className="flex flex-col gap-4">
      <SupabaseWarning />
      <RegisterForm />
    </div>
  );
}
