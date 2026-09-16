import type { TipoVoto } from "@/domain/types";

export type ThemeMode = "light" | "dark";

/**
 * Paleta categórica (hex: Chart.js no interpreta oklch). `Competidor.colorIndex` (ranking estable de
 * la elección) es la preferencia de color; `useColoresCompetidores` la resuelve por respuesta para que
 * los competidores visibles no repitan tono. Sin color disponible se usa `OTROS`: nunca se generan tonos extra.
 *
 * Orden validado para daltonismo (protanopia/deuteranopia ΔE ≥ 8 entre vecinos) y visión
 * normal (ΔE ≥ 15) sobre la superficie de las tarjetas en ambos modos. Aguamarina, amarillo y
 * magenta quedan bajo 3:1 en modo claro: las gráficas los acompañan de etiquetas o leyenda.
 */
const CATEGORICA: Record<ThemeMode, readonly string[]> = {
  light: ["#2A78D6", "#EB6834", "#1BAF7A", "#EDA100", "#E87BA4", "#008300", "#4A3AA7", "#E34948"],
  dark: ["#3987E5", "#D95926", "#199E70", "#C98500", "#D55181", "#008300", "#9085E9", "#E66767"],
};

const OTROS: Record<ThemeMode, string> = { light: "#A2A5AA", dark: "#6E7279" };

/** Neutros con saltos de luminosidad amplios para distinguirse aun siendo vecinos en la dona. */
const ESPECIALES: Record<ThemeMode, Record<Exclude<TipoVoto, "CANDIDATO" | "LISTA">, string>> = {
  light: { BLANCO: "#DCDBD6", NULO: "#55585E", NO_MARCADO: "#83868B" },
  dark: { BLANCO: "#D2D1CD", NULO: "#44484E", NO_MARCADO: "#95989F" },
};

/** Colores oficiales de la bandera de Colombia (acentos de marca). */
export const TRICOLOR = { amarillo: "#FCD116", azul: "#003893", rojo: "#CE1126" } as const;

export const PALETTE_SIZE = CATEGORICA.light.length;

export function colorCompetidor(colorIndex: number, theme: ThemeMode): string {
  return CATEGORICA[theme][colorIndex] ?? OTROS[theme];
}

export function colorOtros(theme: ThemeMode): string {
  return OTROS[theme];
}

export function colorVotoEspecial(tipo: "BLANCO" | "NULO" | "NO_MARCADO", theme: ThemeMode): string {
  return ESPECIALES[theme][tipo];
}

/** Aplica transparencia a un color hex (#RRGGBB). */
export function withAlpha(hex: string, alpha: number): string {
  const channel = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${channel}`;
}
