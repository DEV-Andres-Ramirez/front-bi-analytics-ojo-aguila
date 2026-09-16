/**
 * Departamentos de Colombia: código de la Registraduría (prefijo divipole) → códigos ISO 3166-2
 * (geometrías del mapa, geoBoundaries ADM1) y DANE.
 */
export interface Departamento {
  /** Código de la Registraduría (2 dígitos). */
  codigo: string;
  /** ISO 3166-2, igual a `shapeISO` del TopoJSON. */
  iso: string;
  /** Código DANE (DIVIPOLA). */
  dane: string;
  nombre: string;
}

/** Votos en el exterior: la Registraduría los agrupa como un departamento sin geometría. */
export const CODIGO_CONSULADOS = "88";

export const DEPARTAMENTOS: readonly Departamento[] = [
  { codigo: "01", iso: "CO-ANT", dane: "05", nombre: "Antioquia" },
  { codigo: "03", iso: "CO-ATL", dane: "08", nombre: "Atlántico" },
  { codigo: "05", iso: "CO-BOL", dane: "13", nombre: "Bolívar" },
  { codigo: "07", iso: "CO-BOY", dane: "15", nombre: "Boyacá" },
  { codigo: "09", iso: "CO-CAL", dane: "17", nombre: "Caldas" },
  { codigo: "11", iso: "CO-CAU", dane: "19", nombre: "Cauca" },
  { codigo: "12", iso: "CO-CES", dane: "20", nombre: "Cesar" },
  { codigo: "13", iso: "CO-COR", dane: "23", nombre: "Córdoba" },
  { codigo: "15", iso: "CO-CUN", dane: "25", nombre: "Cundinamarca" },
  { codigo: "16", iso: "CO-DC", dane: "11", nombre: "Bogotá D.C." },
  { codigo: "17", iso: "CO-CHO", dane: "27", nombre: "Chocó" },
  { codigo: "19", iso: "CO-HUI", dane: "41", nombre: "Huila" },
  { codigo: "21", iso: "CO-MAG", dane: "47", nombre: "Magdalena" },
  { codigo: "23", iso: "CO-NAR", dane: "52", nombre: "Nariño" },
  { codigo: "24", iso: "CO-RIS", dane: "66", nombre: "Risaralda" },
  { codigo: "25", iso: "CO-NSA", dane: "54", nombre: "Norte de Santander" },
  { codigo: "26", iso: "CO-QUI", dane: "63", nombre: "Quindío" },
  { codigo: "27", iso: "CO-SAN", dane: "68", nombre: "Santander" },
  { codigo: "28", iso: "CO-SUC", dane: "70", nombre: "Sucre" },
  { codigo: "29", iso: "CO-TOL", dane: "73", nombre: "Tolima" },
  { codigo: "31", iso: "CO-VAC", dane: "76", nombre: "Valle del Cauca" },
  { codigo: "40", iso: "CO-ARA", dane: "81", nombre: "Arauca" },
  { codigo: "44", iso: "CO-CAQ", dane: "18", nombre: "Caquetá" },
  { codigo: "46", iso: "CO-CAS", dane: "85", nombre: "Casanare" },
  { codigo: "48", iso: "CO-LAG", dane: "44", nombre: "La Guajira" },
  { codigo: "50", iso: "CO-GUA", dane: "94", nombre: "Guainía" },
  { codigo: "52", iso: "CO-MET", dane: "50", nombre: "Meta" },
  { codigo: "54", iso: "CO-GUV", dane: "95", nombre: "Guaviare" },
  { codigo: "56", iso: "CO-SAP", dane: "88", nombre: "San Andrés" },
  { codigo: "60", iso: "CO-AMA", dane: "91", nombre: "Amazonas" },
  { codigo: "64", iso: "CO-PUT", dane: "86", nombre: "Putumayo" },
  { codigo: "68", iso: "CO-VAU", dane: "97", nombre: "Vaupés" },
  { codigo: "72", iso: "CO-VID", dane: "99", nombre: "Vichada" },
];

const POR_CODIGO = new Map(DEPARTAMENTOS.map((d) => [d.codigo, d]));
const POR_ISO = new Map(DEPARTAMENTOS.map((d) => [d.iso, d]));

export function departamentoPorCodigo(codigo: string): Departamento | null {
  return POR_CODIGO.get(codigo) ?? null;
}

export function departamentoPorIso(iso: string): Departamento | null {
  return POR_ISO.get(iso) ?? null;
}

/** "16" → "CO-DC"; null para Consulados u otros códigos sin geometría. */
export function isoPorCodigo(codigo: string): string | null {
  return POR_CODIGO.get(codigo)?.iso ?? null;
}

/** "CO-DC" → "16". */
export function codigoPorIso(iso: string): string | null {
  return POR_ISO.get(iso)?.codigo ?? null;
}
