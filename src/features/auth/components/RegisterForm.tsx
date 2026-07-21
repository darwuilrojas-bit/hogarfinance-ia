"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(
        error.message.includes("already registered")
          ? "Ese correo ya está registrado."
          : "No se pudo crear la cuenta. Intentá de nuevo."
      );
      setLoading(false);
      return;
    }

    // Si el proyecto exige confirmación por correo, no hay sesión todavía.
    if (!data.session) {
      setSuccess(true);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (success) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="rounded-xl bg-secondary-light px-4 py-4 text-sm text-secondary-dark">
          ¡Cuenta creada! Revisá tu correo y confirmá tu dirección para poder
          iniciar sesión.
        </p>
        <Link href="/login" className="text-sm font-semibold text-primary">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Correo electrónico"
        type="email"
        placeholder="tu@correo.com"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Contraseña"
        type="password"
        placeholder="Mínimo 6 caracteres"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Input
        label="Confirmar contraseña"
        type="password"
        placeholder="Repetí la contraseña"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" loading={loading}>
        Crear cuenta
      </Button>

      <p className="text-center text-sm text-gray-500">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-semibold text-primary">
          Iniciá sesión
        </Link>
      </p>
    </form>
  );
}
