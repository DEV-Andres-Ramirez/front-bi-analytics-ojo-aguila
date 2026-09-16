const LOCALE = "es-CO";

const numberFormat = new Intl.NumberFormat(LOCALE);
/** `es` y no `es-CO`: el CLDR de es-CO mezcla "K" y "k" según la magnitud dentro de un mismo eje. */
const compactFormat = new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat(LOCALE, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percentPointsFormat = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 1234567 → "1.234.567" */
export function formatNumero(value: number): string {
  return numberFormat.format(value);
}

/** 1234567 → "1,2 M"; 7500 → "7,5 mil" */
export function formatCompacto(value: number): string {
  return compactFormat.format(value);
}

/** Cantidad con el sustantivo concordado: (1, "puesto", "puestos") → "1 puesto". */
export function formatCantidad(cantidad: number, singular: string, plural: string): string {
  return `${numberFormat.format(cantidad)} ${cantidad === 1 ? singular : plural}`;
}

/** 0.4567 → "45,7 %" */
export function formatPct(ratio: number): string {
  return percentFormat.format(ratio);
}

/** Diferencia de proporciones en puntos porcentuales: 0.123 → "12,3 pp" */
export function formatPuntos(ratio: number): string {
  return `${percentPointsFormat.format(ratio * 100)} pp`;
}

const PALABRAS_MINUSCULA = new Set(["de", "del", "la", "las", "los", "y", "e", "el", "en", "por", "a"]);
/** Siglas con puntos internos ("D.C.", "I.E.") o entre comillas ("MAIS") se conservan. */
const SIGLA = /^(\S+\.\S+|"[^"\s]{2,6}"?)$/;

/** Valores del catálogo sin tildes en la fuente. */
const ETIQUETAS_CATALOGO: Record<string, string> = {
  PRESIDENCIA: "Presidencia",
  CONGRESO: "Congreso",
  CAMARA: "Cámara",
  SENADO: "Senado",
  "PRIMERA VUELTA": "Primera vuelta",
  "SEGUNDA VUELTA": "Segunda vuelta",
  TERRITORIALES: "Territoriales",
  ALCALDE: "Alcaldía",
  GOBERNADOR: "Gobernación",
  ASAMBLEA: "Asamblea",
  CONCEJO: "Concejo",
  JAL: "JAL",
};

/** Etiqueta legible de una tipificación o corporación: "CAMARA" → "Cámara". */
export function formatEtiquetaCatalogo(value: string): string {
  return ETIQUETAS_CATALOGO[value] ?? formatNombre(value);
}

/**
 * Nombres en mayúsculas de la fuente → formato título legible.
 * "BOGOTA D.C." → "Bogota D.C."; "NORTE DE SANTANDER" → "Norte de Santander".
 */
export function formatNombre(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  return trimmed
    .split(" ")
    .map((word, index) => {
      if (SIGLA.test(word)) return word;
      const lower = word.toLocaleLowerCase(LOCALE);
      if (index > 0 && PALABRAS_MINUSCULA.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase(LOCALE) + lower.slice(1);
    })
    .join(" ");
}

/** Normaliza texto para búsqueda: minúsculas, sin tildes ni espacios repetidos. */
export function normalizarBusqueda(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
