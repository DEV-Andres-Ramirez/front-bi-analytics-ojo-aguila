import type { CartesianScaleOptions, Chart, FontSpec, Scale, ScriptableContext, TooltipLabelStyle } from "chart.js";
import { toFont } from "chart.js/helpers";
import type { Competidor } from "@/domain/types";
import { withAlpha } from "@/lib/palette";
import type { ChartTheme } from "./use-chart-theme";

/** Opacidad de las marcas que no están resaltadas mientras otra lo está. */
export const ALFA_ATENUADO = 0.3;

const listaFormat = new Intl.ListFormat("es-CO", { style: "long", type: "conjunction" });
const pctEjeFormat = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 });

/** Marcas de eje porcentuales sin decimales: 0.5 → "50 %". */
export function formatPctEje(ratio: number): string {
  return pctEjeFormat.format(ratio);
}

/** ["A", "B", "C"] → "A, B y C" */
export function enumerar(partes: string[]): string {
  return listaFormat.format(partes);
}

const MARGEN_ETIQUETA_PX = 12;

/**
 * Etiqueta del eje de categorías recortada con "…" al ancho disponible, medida con la fuente real.
 * Chart.js limita un eje vertical a la mitad del ancho útil: `reservadoPx` descuenta el padding lateral.
 */
export function etiquetaEje(escala: Scale, texto: string, reservadoPx = 0): string {
  const { width } = escala.chart;
  const anchoMaximo = escala.isHorizontal()
    ? width / Math.max(escala.getTicks().length, 1) - MARGEN_ETIQUETA_PX
    : Math.min(width * 0.4, (width - reservadoPx) / 2) - MARGEN_ETIQUETA_PX;
  const { ctx } = escala;
  ctx.save();
  const { ticks } = escala.options as CartesianScaleOptions;
  ctx.font = toFont(ticks.font as Partial<FontSpec>).string;
  const cabe = (valor: string) => ctx.measureText(valor).width <= anchoMaximo;
  let largo = texto.length;
  while (largo > 1 && !cabe(largo === texto.length ? texto : `${texto.slice(0, largo).trimEnd()}…`)) largo -= 1;
  ctx.restore();
  return largo === texto.length ? texto : `${texto.slice(0, largo).trimEnd()}…`;
}

/** Por contrato, el id de un partido es su código (sin guiones) y el de un candidato es compuesto. */
export function esVistaPartidos(competidores: Competidor[]): boolean {
  return competidores.length > 0 && competidores.every((c) => !c.id.includes("-"));
}

/**
 * Color de una marca según el resaltado: se atenúa si hay otra fila activa.
 * `alfa` permite variantes tenues de la misma serie (#RRGGBB de entrada).
 */
export function colorSegunResaltado(chart: Chart, dataIndex: number, color: string, alfa = 1): string {
  const activos = chart.getActiveElements();
  const atenuada = activos.length > 0 && !activos.some((a) => a.index === dataIndex);
  const opacidad = alfa * (atenuada ? ALFA_ATENUADO : 1);
  return opacidad < 1 ? withAlpha(color, opacidad) : color;
}

/** Colores del tooltip invertido según el tema. */
export function coloresTooltip(tema: ChartTheme) {
  return {
    backgroundColor: tema.tooltipFondo,
    titleColor: tema.tooltipTextoSecundario,
    bodyColor: tema.tooltipTexto,
    footerColor: tema.tooltipTextoSecundario,
    multiKeyBackground: tema.tooltipFondo,
  };
}

/** Clave de serie en el tooltip: trazo corto del color de la marca. */
export function claveTooltip(color: string): TooltipLabelStyle {
  return { backgroundColor: color, borderColor: color, borderWidth: 0, borderRadius: 1.5 };
}

/** Barras apiladas: los ceros se omiten (null) para que no dejen marcas residuales. */
export function valorApilado(valor: number): number | null {
  return valor > 0 ? valor : null;
}

/** Hueco de 2 px entre segmentos apilados; los segmentos muy angostos no se recortan. */
export function huecoSegmento(ctx: ScriptableContext<"bar">): number {
  const escala = ctx.chart.scales[ctx.chart.options.indexAxis === "y" ? "x" : "y"];
  if (!escala || typeof ctx.raw !== "number") return 0;
  const tamano = Math.abs(escala.getPixelForValue(ctx.raw) - escala.getPixelForValue(0));
  return tamano > 4 ? -1 : 0;
}
