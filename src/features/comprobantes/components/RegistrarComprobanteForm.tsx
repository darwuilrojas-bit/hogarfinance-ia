"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { CategoriaIcon } from "@/components/ui/CategoriaIcon";
import { EtiquetaConfianza } from "@/components/ui/ConfianzaOcr";
import { ProveedorInput } from "@/components/ui/ProveedorInput";
import { ZonaCarga } from "./ZonaCarga";
import { pdfAImagen } from "@/lib/pdfAImagen";
import { fechaAIso, isoAFecha } from "@/lib/fechas";
import { formatMontoCompacto, MESES, MESES_CORTOS, periodoActual } from "@/lib/formato";
import {
  BUCKET_COMPROBANTES,
  CATEGORIAS,
  METODOS_PAGO,
} from "@/lib/supabase/types";
import type { Categoria, Factura } from "@/lib/supabase/types";
import type { ResultadoOcr } from "@/app/api/ocr/route";
import { evaluarAnomalia, mensajeAnomalia } from "@/features/alertas/lib/anomalias";

type RegistrarComprobanteFormProps = {
  /** Si viene, la factura ya llega elegida (desde "Registrar pago" en Facturas). */
  facturaIdInicial?: string;
};

/** Tarjeta resumen de la factura elegida, fija arriba del formulario. */
function ResumenFactura({ factura }: { factura: Factura }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary-light/50 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
        <CategoriaIcon categoria={factura.categoria} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">
          {factura.proveedor}
        </p>
        <p className="text-xs text-gray-600">
          {CATEGORIAS[factura.categoria]} ·{" "}
          {MESES[factura.periodo_mes - 1]} {factura.periodo_anio}
        </p>
      </div>
      <p className="text-sm font-bold text-primary">
        {formatMontoCompacto(Number(factura.monto))}
      </p>
    </div>
  );
}

export function RegistrarComprobanteForm({
  facturaIdInicial,
}: RegistrarComprobanteFormProps) {
  const router = useRouter();

  // ---------- Selección de la factura a pagar ----------
  const [factura, setFactura] = useState<Factura | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [pendientes, setPendientes] = useState<Factura[] | null>(null);
  const [busqueda, setBusqueda] = useState("");

  // ---------- Campos del pago (declarados antes: el efecto de abajo
  // usa setMonto al precargar una factura) ----------
  const [monto, setMonto] = useState("");
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [metodoPago, setMetodoPago] = useState("");
  const [numeroOperacion, setNumeroOperacion] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      if (facturaIdInicial) {
        const { data } = await supabase
          .from("facturas")
          .select("*")
          .eq("id", facturaIdInicial)
          .maybeSingle();
        if (!cancelado && data) {
          setFactura(data as Factura);
          setMonto(String((data as Factura).monto));
        }
        return;
      }
      const { data } = await supabase
        .from("facturas")
        .select("*")
        .eq("estado", "pendiente")
        .order("fecha_vencimiento", { ascending: true, nullsFirst: false });
      if (!cancelado) setPendientes((data as Factura[]) ?? []);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [facturaIdInicial]);

  // ---------- Archivo del comprobante de pago y OCR ----------
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<"subiendo" | "analizando" | null>(null);
  const [rutaStorage, setRutaStorage] = useState<string | null>(null);
  const [avisoOcr, setAvisoOcr] = useState<string | null>(null);
  const [avisoAprendizaje, setAvisoAprendizaje] = useState<string[] | null>(null);
  const [avisoMismatch, setAvisoMismatch] = useState<string | null>(null);
  const [ocr, setOcr] = useState<ResultadoOcr | null>(null);
  const urlPrevia = useRef<string | null>(null);

  // ---------- Campos extra para "sin factura previa" ----------
  const hoy = periodoActual();
  const [proveedorNuevo, setProveedorNuevo] = useState("");
  const [categoriaNueva, setCategoriaNueva] = useState("");
  const [periodoMes, setPeriodoMes] = useState(hoy.mes);
  const [periodoAnio, setPeriodoAnio] = useState(hoy.anio);

  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(
    () => () => {
      if (urlPrevia.current) URL.revokeObjectURL(urlPrevia.current);
    },
    []
  );

  function elegirProveedorNuevo(p: { nombre: string; categoria: Categoria }) {
    setProveedorNuevo(p.nombre);
    setCategoriaNueva(p.categoria);
  }

  async function manejarSeleccion(f: File) {
    setError(null);
    setAvisoOcr(null);
    setOcr(null);
    setAvisoAprendizaje(null);
    setAvisoMismatch(null);
    setArchivo(f);
    if (urlPrevia.current) URL.revokeObjectURL(urlPrevia.current);
    const url = f.type.startsWith("image/") ? URL.createObjectURL(f) : null;
    urlPrevia.current = url;
    setPreviewUrl(url);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Tu sesión expiró. Volvé a iniciar sesión.");
      return;
    }

    setProcesando("subiendo");
    const nombreLimpio = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ruta = `${user.id}/pago-${Date.now()}-${nombreLimpio}`;
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET_COMPROBANTES)
      .upload(ruta, f, { contentType: f.type });
    if (errorSubida) {
      setProcesando(null);
      setError("No se pudo subir el archivo. Intentá de nuevo.");
      return;
    }
    setRutaStorage(ruta);

    async function procesarOcr(cuerpo: { path?: string; imagenBase64?: string }) {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await res.json();
      if (!res.ok) {
        setAvisoOcr(datos.error ?? "No se pudieron extraer los datos.");
        return;
      }
      const r = datos as ResultadoOcr;
      setOcr(r);
      setAvisoAprendizaje(
        r.aprendizaje && r.aprendizaje.length > 0 ? r.aprendizaje : null
      );

      if (r.monto !== null) setMonto(String(r.monto));
      if (r.fecha_pago) {
        const iso = fechaAIso(r.fecha_pago);
        if (iso) setFechaPago(iso);
      }
      if (r.numero_comprobante) setNumeroOperacion(r.numero_comprobante);

      if (standalone) {
        if (r.proveedor) setProveedorNuevo(r.proveedor);
        if (r.categoria) setCategoriaNueva(r.categoria);
        if (r.periodo) {
          const [m, a] = r.periodo.split("/").map(Number);
          if (m >= 1 && m <= 12) setPeriodoMes(m);
          if (a >= 2000) setPeriodoAnio(a);
        }
      } else if (factura && r.proveedor) {
        // Avisa si el comprobante parece ser de otro proveedor
        const objetivo = factura.proveedor.toLowerCase();
        const leido = r.proveedor.toLowerCase();
        if (!objetivo.includes(leido) && !leido.includes(objetivo)) {
          setAvisoMismatch(
            `El comprobante parece ser de "${r.proveedor}", pero elegiste la factura de "${factura.proveedor}". Revisá que sea el correcto.`
          );
        }
      }
    }

    setProcesando("analizando");
    try {
      if (f.type === "application/pdf") {
        const dataUrl = await pdfAImagen(f);
        setPreviewUrl(dataUrl);
        await procesarOcr({ imagenBase64: dataUrl });
      } else {
        await procesarOcr({ path: ruta });
      }
    } catch {
      setAvisoOcr(
        f.type === "application/pdf"
          ? "El PDF se guardó, pero no se pudo leer automáticamente. Completá los datos a mano."
          : "No se pudieron extraer los datos. Completá el formulario a mano."
      );
    } finally {
      setProcesando(null);
    }
  }

  /** Actualiza estadísticas del proveedor y corre la detección de anomalías. */
  async function actualizarProveedorYAnomalia(
    userId: string,
    nombreProveedor: string,
    categoria: string,
    montoNum: number,
    periodo: { mes: number; anio: number },
    gastoIdParaAlerta: string | null
  ) {
    const supabase = createClient();
    const { data: existente } = await supabase
      .from("proveedores")
      .select("id, monto_promedio, veces_registrado, fecha_vencimiento_habitual")
      .eq("nombre", nombreProveedor)
      .maybeSingle();
    if (existente) {
      const veces = existente.veces_registrado + 1;
      const promedio =
        (Number(existente.monto_promedio ?? montoNum) *
          existente.veces_registrado +
          montoNum) /
        veces;
      await supabase
        .from("proveedores")
        .update({
          veces_registrado: veces,
          monto_promedio: Math.round(promedio * 100) / 100,
          categoria,
        })
        .eq("id", existente.id);
    } else {
      await supabase.from("proveedores").insert({
        usuario_id: userId,
        nombre: nombreProveedor,
        categoria,
        monto_promedio: montoNum,
        veces_registrado: 1,
      });
    }

    // Detección de anomalías sobre lo efectivamente pagado
    const { data: pagosPrevios } = await supabase
      .from("comprobantes_pago")
      .select("monto, factura:facturas!inner(proveedor, periodo_mes, periodo_anio)")
      .eq("factura.proveedor", nombreProveedor);
    const historicos = (pagosPrevios ?? []).map((p) => {
      const f = Array.isArray(p.factura) ? p.factura[0] : p.factura;
      return {
        proveedor: f.proveedor as string,
        monto: Number(p.monto),
        periodo_mes: f.periodo_mes as number,
        periodo_anio: f.periodo_anio as number,
      };
    });
    const ev = evaluarAnomalia(historicos, nombreProveedor, montoNum, periodo);
    if (ev?.esAnomalia) {
      const mensaje = mensajeAnomalia(nombreProveedor, montoNum, ev.baseline);
      const { data: duplicada } = await supabase
        .from("alertas")
        .select("id")
        .eq("mensaje", mensaje)
        .limit(1);
      if (!duplicada || duplicada.length === 0) {
        await supabase.from("alertas").insert({
          usuario_id: userId,
          gasto_id: gastoIdParaAlerta,
          tipo: "anomalia",
          mensaje,
        });
        window.dispatchEvent(new Event("alertas-actualizadas"));
      }
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0)
      return setError("Ingresá un monto válido.");
    if (!fechaPago) return setError("Elegí la fecha de pago.");
    if (standalone) {
      if (!proveedorNuevo.trim()) return setError("Ingresá el proveedor.");
      if (!categoriaNueva) return setError("Elegí una categoría.");
    } else if (!factura) {
      return setError("Elegí qué factura estás pagando.");
    }

    setGuardando(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setGuardando(false);
      return setError("Tu sesión expiró. Volvé a iniciar sesión.");
    }

    let facturaId: string;
    let nombreProveedor: string;
    let categoriaFinal: string;
    let periodo: { mes: number; anio: number };

    if (standalone) {
      // Crea la factura ya pagada, junto con el comprobante
      const { data: nuevaFactura, error: errorFactura } = await supabase
        .from("facturas")
        .insert({
          usuario_id: user.id,
          proveedor: proveedorNuevo.trim(),
          categoria: categoriaNueva,
          monto: montoNum,
          periodo_mes: periodoMes,
          periodo_anio: periodoAnio,
          estado: "pagado",
        })
        .select("id")
        .single();
      if (errorFactura || !nuevaFactura) {
        setGuardando(false);
        return setError(
          "No se pudo guardar. Verificá que hayas ejecutado supabase/migracion-facturas-comprobantes.sql."
        );
      }
      facturaId = nuevaFactura.id;
      nombreProveedor = proveedorNuevo.trim();
      categoriaFinal = categoriaNueva;
      periodo = { mes: periodoMes, anio: periodoAnio };
    } else {
      facturaId = factura!.id;
      nombreProveedor = factura!.proveedor;
      categoriaFinal = factura!.categoria;
      periodo = { mes: factura!.periodo_mes, anio: factura!.periodo_anio };
      const { error: errorUpdate } = await supabase
        .from("facturas")
        .update({ estado: "pagado" })
        .eq("id", facturaId);
      if (errorUpdate) {
        setGuardando(false);
        return setError("No se pudo actualizar la factura. Intentá de nuevo.");
      }
    }

    // Comprobante de pago, macheado con la factura
    const { data: nuevoComprobante, error: errorComprobante } = await supabase
      .from("comprobantes_pago")
      .insert({
        usuario_id: user.id,
        factura_id: facturaId,
        monto: montoNum,
        fecha_pago: fechaPago,
        metodo_pago: metodoPago || null,
        numero_operacion: numeroOperacion.trim() || null,
        imagen_url: rutaStorage,
        notas: notas.trim() || null,
      })
      .select("id")
      .single();
    if (errorComprobante) {
      setGuardando(false);
      return setError(
        "No se pudo guardar el comprobante. Verificá que hayas ejecutado supabase/migracion-facturas-comprobantes.sql."
      );
    }

    await actualizarProveedorYAnomalia(
      user.id,
      nombreProveedor,
      categoriaFinal,
      montoNum,
      periodo,
      nuevoComprobante?.id ?? null
    );

    // Aprendizaje: correcciones sobre lo leído por el OCR del comprobante
    if (ocr) {
      const correcciones: {
        usuario_id: string;
        campo: "proveedor" | "monto" | "fecha";
        texto_original: string;
        texto_corregido: string;
      }[] = [];
      if (
        standalone &&
        ocr.proveedor &&
        ocr.proveedor !== proveedorNuevo.trim()
      ) {
        correcciones.push({
          usuario_id: user.id,
          campo: "proveedor",
          texto_original: ocr.proveedor,
          texto_corregido: proveedorNuevo.trim(),
        });
      }
      if (ocr.monto !== null && ocr.monto !== montoNum) {
        correcciones.push({
          usuario_id: user.id,
          campo: "monto",
          texto_original: String(ocr.monto),
          texto_corregido: String(montoNum),
        });
      }
      if (ocr.fecha_pago && ocr.fecha_pago !== isoAFecha(fechaPago)) {
        correcciones.push({
          usuario_id: user.id,
          campo: "fecha",
          texto_original: ocr.fecha_pago,
          texto_corregido: isoAFecha(fechaPago),
        });
      }
      if (correcciones.length > 0) {
        await supabase.from("correcciones_ocr").insert(correcciones);
      }
    }

    router.push("/?exito=comprobante");
    router.refresh();
  }

  const ocrListo = ocr !== null;

  // ---------- Paso 1: elegir la factura ----------
  if (!factura && !standalone) {
    const texto = busqueda.trim().toLowerCase();
    const filtradas = (pendientes ?? []).filter((f) =>
      texto === "" ? true : f.proveedor.toLowerCase().includes(texto)
    );
    return (
      <div className="flex flex-col gap-4 px-5 py-5">
        <p className="text-sm text-gray-600">
          ¿Qué factura estás pagando?
        </p>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por proveedor…"
          className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />

        {pendientes === null ? (
          <div className="flex flex-col gap-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : filtradas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
            {pendientes.length === 0
              ? "No tenés facturas pendientes."
              : "Ninguna factura coincide con la búsqueda."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtradas.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => {
                    setFactura(f);
                    setMonto(String(f.monto));
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm active:bg-gray-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
                    <CategoriaIcon categoria={f.categoria} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {f.proveedor}
                    </p>
                    <p className="text-xs text-gray-500">
                      {f.fecha_vencimiento
                        ? `Vence el ${new Date(`${f.fecha_vencimiento}T00:00:00`).getDate()} ${MESES_CORTOS[new Date(`${f.fecha_vencimiento}T00:00:00`).getMonth()]}`
                        : "Sin vencimiento"}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {formatMontoCompacto(Number(f.monto))}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setStandalone(true)}
          className="text-center text-sm font-semibold text-primary"
        >
          Fue un pago sin factura cargada
        </button>
      </div>
    );
  }

  // ---------- Paso 2: registrar el pago ----------
  return (
    <form onSubmit={guardar} className="flex flex-col gap-4 px-5 py-5">
      {factura ? (
        <ResumenFactura factura={factura} />
      ) : (
        <button
          type="button"
          onClick={() => setStandalone(false)}
          className="self-start text-xs font-semibold text-primary"
        >
          ← Elegir una factura pendiente en cambio
        </button>
      )}

      <ZonaCarga
        archivo={archivo}
        previewUrl={previewUrl}
        procesando={procesando}
        onSeleccionar={manejarSeleccion}
        onError={setError}
      />

      {avisoOcr ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
          {avisoOcr}
        </p>
      ) : null}
      {avisoMismatch ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
          ⚠️ {avisoMismatch}
        </p>
      ) : null}
      {ocrListo ? (
        <p className="rounded-xl bg-secondary-light px-4 py-3 text-xs leading-relaxed text-secondary-dark">
          ✨ Datos leídos del comprobante de pago. Revisá antes de confirmar.
        </p>
      ) : null}
      {avisoAprendizaje ? (
        <div className="rounded-xl bg-primary-light px-4 py-3 text-xs leading-relaxed text-primary-dark">
          <p className="font-semibold">
            🧠 El sistema aplicó lo aprendido de tus correcciones:
          </p>
          <ul className="mt-1 list-inside list-disc">
            {avisoAprendizaje.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {standalone ? (
        <>
          <ProveedorInput
            value={proveedorNuevo}
            onChange={setProveedorNuevo}
            onSeleccionar={elegirProveedorNuevo}
            ocrListo={ocrListo}
            score={ocr?.confianza.proveedor ?? 0}
          />
          <Select
            label="Categoría *"
            value={categoriaNueva}
            onChange={(e) => setCategoriaNueva(e.target.value)}
          >
            <option value="">Elegí una categoría…</option>
            {Object.entries(CATEGORIAS).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </Select>
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
        </>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label={
            <EtiquetaConfianza
              texto="Monto pagado *"
              ocrListo={ocrListo}
              score={ocr?.confianza.monto ?? 0}
            />
          }
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0,00"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <Input
          label={
            <EtiquetaConfianza
              texto="Fecha de pago *"
              ocrListo={ocrListo}
              score={ocr?.confianza.fecha_pago ?? 0}
            />
          }
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
        label={
          <EtiquetaConfianza
            texto="Número de operación"
            ocrListo={ocrListo}
            score={ocr?.confianza.numero_comprobante ?? 0}
          />
        }
        type="text"
        placeholder="Ej.: comprobante de transferencia"
        value={numeroOperacion}
        onChange={(e) => setNumeroOperacion(e.target.value)}
      />

      <Textarea
        label="Notas (opcional)"
        placeholder="Algo que quieras recordar de este pago…"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
      />

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="secondary" loading={guardando} disabled={procesando !== null}>
        Confirmar pago
      </Button>
    </form>
  );
}
