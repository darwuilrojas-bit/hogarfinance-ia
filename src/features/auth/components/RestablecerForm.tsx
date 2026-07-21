"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * Segundo paso de recuperación: la página a la que apunta el enlace
 * del correo. Supabase detecta el token de la URL y arma una sesión
 * temporal de recuperación, que acá se usa para fijar la contraseña
 * nueva con updateUser.
 */
export function RestablecerForm() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [enlaceValido, setEnlaceValido] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // El cliente ya parseó el token de recuperación de la URL al
    // cargar la página; solo queda confirmar que quedó la sesión.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEnlaceValido(session !== null);
      setListo(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError("No se pudo actualizar la contraseña. Intentá de nuevo.");
      return;
    }
    setExito(true);
  }

  if (!listo) {
    return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  }

  if (!enlaceValido) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="rounded-xl bg-red-50 px-4 py-4 text-sm text-red-600">
          Este enlace no es válido o ya venció. Pedí uno nuevo.
        </p>
        <Link href="/recuperar" className="text-sm font-semibold text-primary">
          Solicitar un nuevo enlace
        </Link>
      </div>
    );
  }

  if (exito) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="rounded-xl bg-secondary-light px-4 py-4 text-sm text-secondary-dark">
          ¡Listo! Tu contraseña se actualizó correctamente.
        </p>
        <Button
          onClick={() => {
            router.push("/");
            router.refresh();
          }}
        >
          Ir a la app
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">Elegí tu nueva contraseña.</p>
      <Input
        label="Contraseña nueva"
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
        value={confirmar}
        onChange={(e) => setConfirmar(e.target.value)}
      />

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" loading={loading}>
        Guardar contraseña
      </Button>
    </form>
  );
}
