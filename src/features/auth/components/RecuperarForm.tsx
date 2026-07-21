"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * Primer paso de recuperación de contraseña: pide el correo y le
 * envía a Supabase Auth un link que lleva a /restablecer.
 */
export function RecuperarForm() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer`,
    });
    setLoading(false);

    if (error) {
      setError(
        error.message.toLowerCase().includes("rate limit")
          ? "Se enviaron muchos correos en poco tiempo. Esperá unos minutos y probá de nuevo."
          : "No se pudo enviar el correo. Intentá de nuevo."
      );
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="rounded-xl bg-secondary-light px-4 py-4 text-sm text-secondary-dark">
          Si <strong>{email}</strong> tiene una cuenta, te enviamos un correo
          con un enlace para elegir una contraseña nueva. Revisá también la
          carpeta de spam.
        </p>
        <Link href="/login" className="text-sm font-semibold text-primary">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">
        Ingresá tu correo y te mandamos un enlace para elegir una contraseña
        nueva.
      </p>
      <Input
        label="Correo electrónico"
        type="email"
        placeholder="tu@correo.com"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" loading={loading}>
        Enviar enlace de recuperación
      </Button>

      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="font-semibold text-primary">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
