import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { SupabaseWarning } from "@/features/auth/components/SupabaseWarning";

export const metadata: Metadata = {
  title: "Iniciar sesión | HogarFinance IA",
};

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-4">
      <SupabaseWarning />
      <LoginForm />
    </div>
  );
}
