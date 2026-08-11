"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { EtiquetaConfianza } from "@/components/ui/ConfianzaOcr";
import { ProveedorInput } from "@/components/ui/ProveedorInput";
import { ZonaCarga } from "@/features/comprobantes/components/ZonaCarga";
import { pdfAImagen } from "@/lib/pdfAImagen";
import { fechaAIso } from "@/lib/fechas";
import { MESES, periodoActual } from "@/lib/formato";
import { BUCKET_COMPROBANTES, CATEGORIAS } from "@/lib/supabase/types";
import type { ResultadoOcr } from "@/app/api/ocr/route";
import { evaluarAnomalia, mensajeAnomalia } from "@/features/alertas/lib/anomalias";
import {
  camposAPreguntar,
  registroDeRespuesta,
  senalesAutomaticas,
  type CampoSenal,
  type RespuestaUsuario,
  type SenalPrevia,
} from "@/features/facturas/lib/senalesOcr";
import { AvisoCamposVacios } from "@/features/facturas/components/AvisoCamposVacios";

type NuevaFacturaFormProps = {
  /** Si viene un id, el formulario edita esa factura en lugar de crear una. */
  facturaId?: string;
};

/**
 * Alta o edición de una factura: se carga al llegar, con su(s)
 * vencimiento(s) — sin fecha de pago, porque todavía no se pagó.
 * El OCR lee la imagen y pre-completa los campos con su confianza.
 */
export function NuevaFacturaForm({ facturaId }: NuevaFacturaFormProps) {
  const router = useRouter();
  const editando = facturaId !== undefined;

  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<"subiendo" | "analizando" | null>(null);
  const [rutaStorage, setRutaStorage] = useState<string | null>(null);
  const [rutaAnterior, setRutaAnterior] = useState<string | null>(null);
  const [existenteNombre, setExistenteNombre] = useState<string | null>(null);
  const [avisoOcr, setAvisoOcr] = useState<string | null>(null);
  const [avisoAprendizaje, setAvisoAprendizaje] = useState<string[] | null>(null);
  const [ocr, setOcr] = useState<ResultadoOcr | null>(null);

  const hoy = periodoActual();
  const [proveedor, setProveedor] = useState("");
  const [monto, setMonto] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [fechaVencimiento2, setFechaVencimiento2] = useState("");
  const [periodoMes, setPeriodoMes] = useState(hoy.mes);
  const [periodoAnio, setPeriodoAnio] = useState(hoy.anio);
  const [categoria, setCategoria] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [notas, setNotas] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const urlPrevia = useRef<string | null>(null);

  // Señales del agente sobre campos que el OCR no completó.
  const [senalesPrevias, setSenalesPrevias] = useState<SenalPrevia[]>([]);
  const [camposVacios, setCamposVacios] = useState<CampoSenal[]>([]);
  const [respondidos, setRespondidos] = useState<
    Partial<Record<CampoSenal, RespuestaUsuario>>
  >({});

  useEffect(() => {
    let cancelado = false;
    async function cargarSenales() {
      const supabase = createClient();
      // RLS ya limita la consulta a las filas del usuario.
      const { data } = await supabase
        .from("correcciones_ocr")
        .select("campo, proveedor, tipo")
        .eq("tipo", "ausente");
      if (!cancelado && data) setSenalesPrevias(data);
    }
    cargarSenales();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(
    () => () => {
      if (urlPrevia.current) URL.revokeObjectURL(urlPrevia.current);
    },
    []
  );

  // Modo edición: precarga la factura
  useEffect(() => {
    if (!facturaId) return;
    let cancelado = false;
    async function cargar() {
      const supabase = createClient();
      const { data: f } = await supabase
        .from("facturas")
        .select("*")
        .eq("id", facturaId)
        .maybeSingle();
      if (cancelado || !f) return;
      setProveedor(f.proveedor);
      setMonto(String(f.monto));
      setFechaVencimiento(f.fecha_vencimiento ?? "");
      setFechaVencimiento2(f.fecha_vencimiento_2 ?? "");
      setPeriodoMes(f.periodo_mes);
      setPeriodoAnio(f.periodo_anio);
      setCategoria(f.categoria);
      setNumeroFactura(f.numero_comprobante ?? "");
      setNotas(f.notas ?? "");
      if (f.imagen_url) {
        setRutaStorage(f.imagen_url);
        setRutaAnterior(f.imagen_url);
        setExistenteNombre(f.imagen_url.split("/").pop() ?? "factura");
        if (!f.imagen_url.toLowerCase().endsWith(".pdf")) {
          const { data: firmada } = await supabase.storage
            .from(BUCKET_COMPROBANTES)
            .createSignedUrl(f.imagen_url, 3600);
          if (!cancelado && firmada) setPreviewUrl(firmada.signedUrl);
        }
      }
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [facturaId]);

  function elegirProveedor(p: { nombre: string; categoria: string }) {
    setProveedor(p.nombre);
    setCategoria(p.categoria);
  }

  async function manejarSeleccion(f: File) {
    setError(null);
    setAvisoOcr(null);
    setOcr(null);
    setAvisoAprendizaje(null);
    setArchivo(f);
    setExistenteNombre(null);
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
    const ruta = `${user.id}/${Date.now()}-${nombreLimpio}`;
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
      if (r.proveedor) setProveedor(r.proveedor);
      if (r.monto !== null) setMonto(String(r.monto));
      if (r.fecha_vencimiento) {
        const iso = fechaAIso(r.fecha_vencimiento);
        if (iso) setFechaVencimiento(iso);
      }
      if (r.fecha_vencimiento_2) {
        const iso = fechaAIso(r.fecha_vencimiento_2);
        if (iso) setFechaVencimiento2(iso);
      }
      if (r.periodo) {
        const [m, a] = r.periodo.split("/").map(Number);
        if (m >= 1 && m <= 12) setPeriodoMes(m);
        if (a >= 2000) setPeriodoAnio(a);
      }
      if (r.numero_comprobante) setNumeroFactura(r.numero_comprobante);
      if (r.categoria) setCategoria(r.categoria);
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

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const montoNum = Number(monto);
    if (!proveedor.trim()) return setError("Ingresá el proveedor.");
    if (!Number.isFinite(montoNum) || montoNum <= 0)
      return setError("Ingresá un monto válido.");
    if (!fechaVencimiento)
      return setError("Ingresá al menos el primer vencimiento.");
    if (!categoria) return setError("Elegí una categoría.");

    // Primer intento: si hay campos que el OCR no completó, avisar una vez.
    // No bloquea — el segundo toque guarda igual, se haya respondido o no.
    const aPreguntar = camposAPreguntar(
      ocr
        ? {
            numero_comprobante: ocr.numero_comprobante,
            fecha_vencimiento_2: ocr.fecha_vencimiento_2,
          }
        : null,
      {
        numero_comprobante: numeroFactura,
        fecha_vencimiento_2: fechaVencimiento2,
      },
      senalesPrevias,
      proveedor
    );
    if (aPreguntar.length > 0 && camposVacios.length === 0) {
      setCamposVacios(aPreguntar);
      return;
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

    const datosFactura = {
      proveedor: proveedor.trim(),
      monto: montoNum,
      periodo_mes: periodoMes,
      periodo_anio: periodoAnio,
      categoria,
      fecha_vencimiento: fechaVencimiento,
      fecha_vencimiento_2: fechaVencimiento2 || null,
      numero_comprobante: numeroFactura.trim() || null,
      notas: notas.trim() || null,
      imagen_url: rutaStorage,
    };

    let errorFactura;
    let nuevoId: string | null = null;
    if (editando) {
      ({ error: errorFactura } = await supabase
        .from("facturas")
        .update(datosFactura)
        .eq("id", facturaId!));
    } else {
      const res = await supabase
        .from("facturas")
        .insert({ ...datosFactura, usuario_id: user.id, estado: "pendiente" })
        .select("id")
        .single();
      errorFactura = res.error;
      nuevoId = res.data?.id ?? null;
    }
    if (errorFactura) {
      setGuardando(false);
      console.error("Error al guardar la factura:", errorFactura);
      return setError(
        "No pudimos guardar la factura. Revisá los datos e intentá de nuevo."
      );
    }

    if (editando && rutaAnterior && rutaStorage !== rutaAnterior) {
      await supabase.storage.from(BUCKET_COMPROBANTES).remove([rutaAnterior]);
    }

    // Registra o actualiza el proveedor (categoría y día habitual como
    // referencia). El promedio se calcula al registrar pagos, no acá.
    if (!editando) {
      const diaVenc = Number(fechaVencimiento.split("-")[2]);
      const { data: existente } = await supabase
        .from("proveedores")
        .select("id, fecha_vencimiento_habitual")
        .eq("nombre", proveedor.trim())
        .maybeSingle();
      if (existente) {
        await supabase
          .from("proveedores")
          .update({
            categoria,
            fecha_vencimiento_habitual:
              existente.fecha_vencimiento_habitual ?? diaVenc,
          })
          .eq("id", existente.id);
      } else {
        await supabase.from("proveedores").insert({
          usuario_id: user.id,
          nombre: proveedor.trim(),
          categoria,
          fecha_vencimiento_habitual: diaVenc,
          veces_registrado: 0,
        });
      }

      // Detección de anomalías sobre el monto facturado (antes de pagar,
      // para poder reaccionar a tiempo). Ver docs/especificacion-analitica.md
      const { data: pagosPrevios } = await supabase
        .from("comprobantes_pago")
        .select("monto, factura:facturas!inner(proveedor, periodo_mes, periodo_anio)")
        .eq("factura.proveedor", proveedor.trim());
      const historicos = (pagosPrevios ?? []).map((p) => {
        const f = Array.isArray(p.factura) ? p.factura[0] : p.factura;
        return {
          proveedor: f.proveedor as string,
          monto: Number(p.monto),
          periodo_mes: f.periodo_mes as number,
          periodo_anio: f.periodo_anio as number,
        };
      });
      const ev = evaluarAnomalia(historicos, proveedor.trim(), montoNum, {
        mes: periodoMes,
        anio: periodoAnio,
      });
      if (ev?.esAnomalia) {
        const mensaje = mensajeAnomalia(proveedor.trim(), montoNum, ev.baseline);
        const { data: duplicada } = await supabase
          .from("alertas")
          .select("id")
          .eq("mensaje", mensaje)
          .limit(1);
        if (!duplicada || duplicada.length === 0) {
          await supabase.from("alertas").insert({
            usuario_id: user.id,
            gasto_id: nuevoId,
            tipo: "anomalia",
            mensaje,
          });
          window.dispatchEvent(new Event("alertas-actualizadas"));
        }
      }
    }

    // Aprendizaje: correcciones sobre lo leído por el OCR
    if (ocr) {
      const correcciones: {
        usuario_id: string;
        campo: "proveedor" | "monto" | "fecha";
        texto_original: string;
        texto_corregido: string;
      }[] = [];
      if (ocr.proveedor && ocr.proveedor !== proveedor.trim()) {
        correcciones.push({
          usuario_id: user.id,
          campo: "proveedor",
          texto_original: ocr.proveedor,
          texto_corregido: proveedor.trim(),
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
      // El OCR no leyó el campo y el usuario lo completó a mano: esa es la
      // evidencia de que el agente falló. Se registra sin preguntar.
      const automaticas = senalesAutomaticas(
        {
          numero_comprobante: ocr.numero_comprobante,
          fecha_vencimiento_2: ocr.fecha_vencimiento_2,
        },
        {
          numero_comprobante: numeroFactura,
          fecha_vencimiento_2: fechaVencimiento2,
        },
        proveedor,
        user.id
      );

      const respuestas = (
        Object.entries(respondidos) as [CampoSenal, RespuestaUsuario][]
      ).map(([campo, respuesta]) =>
        registroDeRespuesta(campo, respuesta, proveedor, user.id)
      );

      const filas = [...correcciones, ...automaticas, ...respuestas];
      if (filas.length > 0) {
        // Si falla, la factura ya se guardó: la señal es secundaria.
        const { error: errorSenal } = await supabase
          .from("correcciones_ocr")
          .insert(filas);
        if (errorSenal) {
          console.error("No se pudieron registrar las señales:", errorSenal);
        }
      }
    }

    router.push(editando ? "/facturas" : "/facturas?exito=factura");
    router.refresh();
  }

  const ocrListo = ocr !== null;

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4 px-5 py-5">
      <ZonaCarga
        archivo={archivo}
        previewUrl={previewUrl}
        existenteNombre={existenteNombre}
        procesando={procesando}
        onSeleccionar={manejarSeleccion}
        onError={setError}
      />

      {avisoOcr ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
          {avisoOcr}
        </p>
      ) : null}

      {ocrListo ? (
        <p className="rounded-xl bg-secondary-light px-4 py-3 text-xs leading-relaxed text-secondary-dark">
          ✨ Datos extraídos de la factura. ✔ alta confianza, ~ media, ⚠ baja
          o sin leer. Revisá sobre todo los ámbar antes de guardar.
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

      <ProveedorInput
        value={proveedor}
        onChange={setProveedor}
        onSeleccionar={elegirProveedor}
        ocrListo={ocrListo}
        score={ocr?.confianza.proveedor ?? 0}
      />

      <Input
        label={
          <EtiquetaConfianza
            texto="Monto de la factura *"
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

      {/* Vencimientos de la factura */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-700">
          <EtiquetaConfianza
            texto="Vencimientos *"
            ocrListo={ocrListo}
            score={ocr?.confianza.fecha_vencimiento ?? 0}
          />
        </span>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">1er vencimiento</label>
            <input
              type="date"
              aria-label="Primer vencimiento"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">
              2do vencimiento (si tiene)
            </label>
            <input
              type="date"
              aria-label="Segundo vencimiento"
              value={fechaVencimiento2}
              onChange={(e) => setFechaVencimiento2(e.target.value)}
              className="h-12 rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Te avisamos antes del 1°; si pasa sin pago, seguimos con el 2°.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-700">
          <EtiquetaConfianza
            texto="Período de la factura"
            ocrListo={ocrListo}
            score={ocr?.confianza.periodo ?? 0}
          />
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

      <Select
        label={
          <EtiquetaConfianza
            texto="Categoría *"
            ocrListo={ocrListo}
            score={ocr?.confianza.categoria ?? 0}
          />
        }
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
      >
        <option value="">Elegí una categoría…</option>
        {Object.entries(CATEGORIAS).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </Select>

      <Input
        label={
          <EtiquetaConfianza
            texto="Número de factura"
            ocrListo={ocrListo}
            score={ocr?.confianza.numero_comprobante ?? 0}
          />
        }
        type="text"
        placeholder="Ej.: 0001-00023456 o LSP"
        value={numeroFactura}
        onChange={(e) => setNumeroFactura(e.target.value)}
      />

      <Textarea
        label="Notas (opcional)"
        placeholder="Algo que quieras recordar de esta factura…"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
      />

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <AvisoCamposVacios
        campos={camposVacios}
        respondidos={respondidos}
        onResponder={(campo, respuesta) =>
          setRespondidos((r) => ({ ...r, [campo]: respuesta }))
        }
      />

      <Button type="submit" loading={guardando} disabled={procesando !== null}>
        {camposVacios.length > 0
          ? "Guardar igual"
          : editando
            ? "Guardar cambios"
            : "Guardar factura"}
      </Button>
    </form>
  );
}
