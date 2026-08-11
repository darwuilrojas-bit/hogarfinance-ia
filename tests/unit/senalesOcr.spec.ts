import { expect, test } from "@playwright/test";
import {
  camposAPreguntar,
  registroDeRespuesta,
  senalesAutomaticas,
  type LecturaOcr,
  type SenalPrevia,
  type ValoresFormulario,
} from "@/features/facturas/lib/senalesOcr";

const USUARIO = "user-1";
const PROVEEDOR = "AySA";

const VACIO: ValoresFormulario = {
  numero_comprobante: "",
  fecha_vencimiento_2: "",
};

test("no genera senal cuando el OCR leyo el campo", () => {
  const ocr: LecturaOcr = {
    numero_comprobante: "0111B15587107",
    fecha_vencimiento_2: "16/07/2026",
  };
  const valores: ValoresFormulario = {
    numero_comprobante: "0111B15587107",
    fecha_vencimiento_2: "2026-07-16",
  };
  expect(senalesAutomaticas(ocr, valores, PROVEEDOR, USUARIO)).toEqual([]);
  expect(camposAPreguntar(ocr, valores, [], PROVEEDOR)).toEqual([]);
});

test("caso A: el OCR no leyo y el usuario lo completo a mano", () => {
  const ocr: LecturaOcr = {
    numero_comprobante: null,
    fecha_vencimiento_2: null,
  };
  const valores: ValoresFormulario = {
    numero_comprobante: "0111B15587107",
    fecha_vencimiento_2: "",
  };

  expect(senalesAutomaticas(ocr, valores, PROVEEDOR, USUARIO)).toEqual([
    {
      usuario_id: USUARIO,
      campo: "numero_comprobante",
      tipo: "no_leido",
      proveedor: PROVEEDOR,
      texto_original: null,
      texto_corregido: "0111B15587107",
    },
  ]);

  // El que completo a mano ya quedo registrado: no se pregunta de nuevo.
  expect(camposAPreguntar(ocr, valores, [], PROVEEDOR)).toEqual([
    "fecha_vencimiento_2",
  ]);
});

test("caso B: el OCR no leyo y el campo quedo vacio", () => {
  const ocr: LecturaOcr = {
    numero_comprobante: null,
    fecha_vencimiento_2: null,
  };
  expect(senalesAutomaticas(ocr, VACIO, PROVEEDOR, USUARIO)).toEqual([]);
  expect(camposAPreguntar(ocr, VACIO, [], PROVEEDOR)).toEqual([
    "numero_comprobante",
    "fecha_vencimiento_2",
  ]);
});

test("no pregunta por un campo ya marcado ausente para ese proveedor", () => {
  const ocr: LecturaOcr = {
    numero_comprobante: null,
    fecha_vencimiento_2: null,
  };
  const previas: SenalPrevia[] = [
    { campo: "fecha_vencimiento_2", proveedor: "AySA", tipo: "ausente" },
  ];
  expect(camposAPreguntar(ocr, VACIO, previas, PROVEEDOR)).toEqual([
    "numero_comprobante",
  ]);
});

test("una senal ausente de otro proveedor no aplica", () => {
  const ocr: LecturaOcr = {
    numero_comprobante: null,
    fecha_vencimiento_2: null,
  };
  const previas: SenalPrevia[] = [
    { campo: "fecha_vencimiento_2", proveedor: "Edesur", tipo: "ausente" },
  ];
  expect(camposAPreguntar(ocr, VACIO, previas, PROVEEDOR)).toEqual([
    "numero_comprobante",
    "fecha_vencimiento_2",
  ]);
});

test("compara proveedores sin distinguir mayusculas ni tildes", () => {
  const ocr: LecturaOcr = {
    numero_comprobante: null,
    fecha_vencimiento_2: null,
  };
  const previas: SenalPrevia[] = [
    { campo: "numero_comprobante", proveedor: "  aysa  ", tipo: "ausente" },
  ];
  expect(camposAPreguntar(ocr, VACIO, previas, "AySA")).toEqual([
    "fecha_vencimiento_2",
  ]);
});

test("una senal no_leido previa no silencia la pregunta", () => {
  const ocr: LecturaOcr = {
    numero_comprobante: null,
    fecha_vencimiento_2: null,
  };
  const previas: SenalPrevia[] = [
    { campo: "numero_comprobante", proveedor: "AySA", tipo: "no_leido" },
  ];
  expect(camposAPreguntar(ocr, VACIO, previas, PROVEEDOR)).toEqual([
    "numero_comprobante",
    "fecha_vencimiento_2",
  ]);
});

test("si el OCR no corrio no se pregunta ni se registra nada", () => {
  expect(senalesAutomaticas(null, VACIO, PROVEEDOR, USUARIO)).toEqual([]);
  expect(camposAPreguntar(null, VACIO, [], PROVEEDOR)).toEqual([]);
});

test("cada respuesta produce su fila", () => {
  expect(
    registroDeRespuesta("numero_comprobante", "ausente", PROVEEDOR, USUARIO)
  ).toEqual({
    usuario_id: USUARIO,
    campo: "numero_comprobante",
    tipo: "ausente",
    proveedor: PROVEEDOR,
    texto_original: null,
    texto_corregido: null,
  });

  expect(
    registroDeRespuesta("numero_comprobante", "no_leido", PROVEEDOR, USUARIO)
  ).toEqual({
    usuario_id: USUARIO,
    campo: "numero_comprobante",
    tipo: "no_leido",
    proveedor: PROVEEDOR,
    texto_original: null,
    texto_corregido: null,
  });
});
