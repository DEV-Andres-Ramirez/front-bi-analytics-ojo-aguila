import { normalizarBusqueda } from "./format";

export type CeldaCsv = string | number | null | undefined;

export interface ColumnaCsv<T> {
  encabezado: string;
  valor: (fila: T) => CeldaCsv;
}

/** Excel en configuración regional es-CO usa ";" como separador de listas y "," como decimal. */
const SEPARADOR = ";";
const BOM = "﻿";
const INICIO_FORMULA = /^[=+\-@\t\r]/;
const REQUIERE_COMILLAS = /[";\r\n]/;

function celdaATexto(celda: CeldaCsv): string {
  if (celda === null || celda === undefined) return "";
  if (typeof celda === "number") {
    return Number.isInteger(celda) ? String(celda) : String(celda).replace(".", ",");
  }
  // Evita que hojas de cálculo interpreten el texto como fórmula (inyección CSV).
  const seguro = INICIO_FORMULA.test(celda) ? `'${celda}` : celda;
  return REQUIERE_COMILLAS.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export function generarCsv<T>(filas: readonly T[], columnas: readonly ColumnaCsv<T>[]): string {
  const lineas = [
    columnas.map((columna) => celdaATexto(columna.encabezado)),
    ...filas.map((fila) => columnas.map((columna) => celdaATexto(columna.valor(fila)))),
  ];
  return lineas.map((celdas) => celdas.join(SEPARADOR)).join("\r\n");
}

/** Proporción 0..1 → porcentaje con dos decimales (45.678 → 45,68 en la hoja). */
export function porcentajeCsv(ratio: number | null | undefined): number | null {
  return ratio === null || ratio === undefined ? null : Math.round(ratio * 10_000) / 100;
}

/** ["Presidencia", "Primera vuelta", "2022"] → "presidencia-primera-vuelta-2022.csv" */
export function nombreArchivoCsv(partes: readonly string[]): string {
  const slug = partes
    .map((parte) => normalizarBusqueda(parte).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .join("_");
  return `${slug || "resultados"}.csv`;
}

/** Descarga el contenido como archivo CSV (UTF-8 con BOM para que Excel respete las tildes). */
export function descargarCsv(nombreArchivo: string, contenido: string): void {
  const blob = new Blob([BOM, contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.style.display = "none";
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
