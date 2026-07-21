"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ZonaCarga } from "@/features/comprobantes/components/ZonaCarga";
import { MESES, periodoActual } from "@/lib/formato";
import { BUCKET_COMPROBANTES, CATEGORIAS, METODOS_PAGO } from "@/lib/supabase/types";

/**
 * Edición de un pago ya registrado (ledger de Gastos): permite
 * corregir los datos de la factura asociada (proveedor, categoría,
 * período) y del pago en sí (monto, fecha, método, comprobante).
 */
export function EditarComprobanteForm({ comprobanteId }: { comprobanteId: string }) {
  const router = useRouter();

  const [facturaId, setFacturaId] = useState<string | null>(null);
  const [proveedor, setProveedor] = useState("");
  const [categoria, setCategoria] = useState("");
  const hoy = periodoActual();
  const [periodoMes, setPeriodoMes] = useState(hoy.mes);
  const [periodoAnio, setPeriodoAnio] = useState(hoy.anio);

  const [monto, setMonto] = useState("");
  const [fechaPago, setFechaPago] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [numeroOperacion, setNumeroOperacion] = useState("");
  const [notas, setNotas] = useState("");

  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [existenteNombre, setExistenteNombre] = useState<string | null>(null);
  const [rutaStorage, setRutaStorage] = useState<string | null>(null);
  const [rutaAnterior, setRutaAnterior] = useState<string | null>(null);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      const { data } = await supabase
        .from("comprobantes_pago")
        .select(
          "monto, fecha_pago, metodo_pago, numero_operacion, notas, imagen_url, factura:facturas(id, proveedor, categoria, periodo_mes, periodo_anio)"
        )
        .eq("id", comprobanteId)
        .maybeSingle();
      if (cancelado || !data) {
        setCargando(false);
        return;
      }
      const f = Array.isArray(data.factura) ? data.factura[0] : data.factura;
      setFacturaId(f.id);
      setProveedor(f.proveedor);
      setCategoria(f.categoria);
      setPeriodoMes(f.periodo_mes);
      setPeriodoAnio(f.periodo_anio);
      setMonto(String(data.monto));
      setFechaPago(data.fecha_pago);
      setMetodoPago(data.metodo_pago ?? "");
      setNumeroOperacion(data.numero_operacion ?? "");
      setNotas(data.notas ?? "");
      if (data.imagen_url) {
        setRutaStorage(data.imagen_url);
        setRutaAnterior(data.imagen_url);
        setExistenteNombre(data.imagen_url.split("/").pop() ?? "comprobante");
        if (!data.imagen_url.toLowerCase().endsWith(".pdf")) {
          const { data: firmada } = await supabase.storage
            .from(BUCKET_COMPROBANTES)
            .createSignedUrl(data.imagen_url, 3600);
          if (!cancelado && firmada) setPreviewUrl(firmada.signedUrl);
        }
      }
      setCargando(false);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [comprobanteId]);

  async function manejarSeleccion(f: File) {
    setError(null);
    setArchivo(f);
    setExistenteNombre(null);
    const url = f.type.startsWith("image/") ? URL.createObjectURL(f) : null;
    setPreviewUrl(url);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Tu sesión expiró. Volvé a iniciar sesión.");
      return;
    }
    const nombreLimpio = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ruta = `${user.id}/pago-${Date.now()}-${nombreLimpio}`;
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET_COMPROBANTES)
      .upload(ruta, f, { contentType: f.type });
    if (errorSubida) {
      setError("No se pudo subir el archivo. Intentá de nuevo.");
      return;
    }
    setRutaStorage(ruta);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const montoNum = Number(monto);
    if (!proveedor.trim()) return setError("Ingresá el proveedor.");
    if (!Number.isFinite(montoNum) || montoNum <= 0)
      return setError("Ingresá un monto válido.");
    if (!fechaPago) return setError("Elegí la fecha de pago.");
    if (!categoria) return setError("Elegí una categoría.");
    if (!facturaId) return setError("No se encontró la factura asociada.");

    setGuardando(true);
    const supabase = createClient();

    const { error: errorFactura } = await supabase
      .from("facturas")
      .update({
        proveedor: proveedor.trim(),
        categoria,
        periodo_mes: periodoMes,
        periodo_anio: periodoAnio,
      })
      .eq("id", facturaId);

    const { error: errorComprobante } = await supabase
      .from("comprobantes_pago")
      .update({
        monto: montoNum,
        fecha_pago: fechaPago,
        metodo_pago: metodoPago || null,
        numero_operacion: numeroOperacion.trim() || null,
        notas: notas.trim() || null,
        imagen_url: rutaStorage,
      })
      .eq("id", comprobanteId);

    if (rutaAnterior && rutaStorage !== rutaAnterior) {
      await supabase.storage.from(BUCKET_COMPROBANTES).remove([rutaAnterior]);
    }

    setGuardando(false);
    if (errorFactura || errorComprobante) {
      return setError("No se pudo guardar. Intentá de nuevo.");
    }
    router.push("/gastos");
    router.refresh();
  }

  if (cargando) {
    return (
      <div className="flex flex-col gap-3 px-5 py-5">
        <div className="h-32 animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4 px-5 py-5">
      <ZonaCarga
        archivo={archivo}
        previewUrl={previewUrl}
        existenteNombre={existenteNombre}
        procesando={null}
        onSeleccionar={manejarSeleccion}
        onError={setError}
      />

      <Input
        label="Proveedor *"
        type="text"
        value={proveedor}
        onChange={(e) => setProveedor(e.target.value)}
      />

      <Select
        label="Categoría *"
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
      >
        {Object.entries(CATEGORIAS).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </Select>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-700">
          Período de la factura
        </span>
        <div className="grid grid-cols-2 gap-3">
          <select
            aria-label="Mes del período"
            value={periodoMes}
            onChange={(e) => setPeriodoMes(Number(e.target.value))}
            className="h-12 appearance-none rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            aria-label="Año del período"
            value={periodoAnio}
            onChange={(e) => setPeriodoAnio(Number(e.target.value))}
            className="h-12 appearance-none rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {Array.from({ length: 5 }, (_, i) => hoy.anio + 1 - i).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Monto pagado *"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <Input
          label="Fecha de pago *"
          type="date"
          value={fechaPago}
          onChange={(e) => setFechaPago(e.target.value)}
        />
      </div>

      <Select
        label="Método de pago"
        value={metodoPago}
        onChange={(e) => setMetodoPago(e.target.value)}
      >
        <option value="">Sin especificar</option>
        {METODOS_PAGO.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </Select>

      <Input
        label="Número de operación"
        type="text"
        value={numeroOperacion}
        onChange={(e) => setNumeroOperacion(e.target.value)}
      />

      <Textarea
        label="Notas (opcional)"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
      />

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" loading={guardando}>
        Guardar cambios
      </Button>
    </form>
  );
}
