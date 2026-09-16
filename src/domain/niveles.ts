import type { NivelId } from "./types";

export interface NivelDef {
  id: NivelId;
  /** Longitud del código (prefijo divipole) que identifica una unidad de este nivel. */
  longitud: number;
  etiqueta: string;
  etiquetaPlural: string;
  habilitado: boolean;
}

/**
 * Jerarquía geográfica. El divipole (`DD MMM ZZ PP`) es jerárquico, así que el largo
 * del prefijo determina el nivel.
 *
 * `mesa` está deshabilitado: la tabla fuente no tiene número de mesa. Para habilitarlo
 * se requiere la columna `codigo_mesa` (ver AGENTS.md › "Habilitar nivel Mesa").
 */
export const NIVELES: readonly NivelDef[] = [
  { id: "nacional", longitud: 0, etiqueta: "Nacional", etiquetaPlural: "Nacional", habilitado: true },
  { id: "departamento", longitud: 2, etiqueta: "Departamento", etiquetaPlural: "Departamentos", habilitado: true },
  { id: "municipio", longitud: 5, etiqueta: "Municipio", etiquetaPlural: "Municipios", habilitado: true },
  { id: "zona", longitud: 7, etiqueta: "Zona", etiquetaPlural: "Zonas", habilitado: true },
  { id: "puesto", longitud: 9, etiqueta: "Puesto", etiquetaPlural: "Puestos", habilitado: true },
  { id: "mesa", longitud: 12, etiqueta: "Mesa", etiquetaPlural: "Mesas", habilitado: false },
];

const NIVELES_HABILITADOS = NIVELES.filter((n) => n.habilitado);

/** Patrón del código de un nivel. Algunos puestos de la fuente terminan en letras (p. ej. "0100199A1"). */
function patronCodigo({ id, longitud }: NivelDef): string {
  return id === "puesto" ? "\\d{7}[0-9A-Z]{2}" : `\\d{${longitud}}`;
}

/** Código geográfico válido: vacío (Colombia) o prefijo divipole de un nivel habilitado. */
export const CODIGO_GEO_REGEX = new RegExp(
  `^(${NIVELES_HABILITADOS.filter((n) => n.longitud > 0)
    .map(patronCodigo)
    .join("|")})?$`,
);

export function esCodigoGeoValido(codigo: string): boolean {
  return CODIGO_GEO_REGEX.test(codigo);
}

export function getNivel(id: NivelId): NivelDef {
  const nivel = NIVELES.find((n) => n.id === id);
  if (!nivel) throw new Error(`Nivel desconocido: ${id}`);
  return nivel;
}

/** Nivel correspondiente a un código geográfico (por su longitud). */
export function nivelDeCodigo(codigo: string): NivelDef {
  const nivel = NIVELES_HABILITADOS.find((n) => n.longitud === codigo.length);
  if (!nivel) throw new Error(`Código geográfico inválido: "${codigo}"`);
  return nivel;
}

/** Siguiente nivel habilitado o null si el nivel es hoja. */
export function nivelHijo(id: NivelId): NivelDef | null {
  const index = NIVELES_HABILITADOS.findIndex((n) => n.id === id);
  return NIVELES_HABILITADOS[index + 1] ?? null;
}

/** Código del padre inmediato o null para Colombia. */
export function codigoPadre(codigo: string): string | null {
  const index = NIVELES_HABILITADOS.findIndex((n) => n.longitud === codigo.length);
  if (index <= 0) return null;
  return codigo.slice(0, NIVELES_HABILITADOS[index - 1].longitud);
}

/** Códigos desde Colombia hasta el código dado: "0100101" → ["", "01", "01001", "0100101"]. */
export function rutaDeCodigo(codigo: string): string[] {
  return NIVELES_HABILITADOS.filter((n) => n.longitud <= codigo.length).map((n) =>
    codigo.slice(0, n.longitud),
  );
}
