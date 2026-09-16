"use client";

import { useMemo } from "react";
import { useTheme } from "@/components/theme/use-theme";
import { colorOtros, colorVotoEspecial, type ThemeMode } from "@/lib/palette";

type TipoVotoEspecial = Parameters<typeof colorVotoEspecial>[0];

/** Colores de la estructura de las gráficas (hex), alineados con los tokens de `globals.css`. */
interface ColoresEstructura {
  texto: string;
  textoSecundario: string;
  /** Líneas de grilla: un paso sobre la superficie, casi imperceptibles. */
  grilla: string;
  /** Ejes y marcos. */
  borde: string;
  /** Fondo de las tarjetas: separa marcas contiguas (huecos de 2 px). */
  superficie: string;
  /** Unidades sin resultados (mapa). */
  sinDatos: string;
  /** Unidades con empate en el primer lugar (mapa): neutro distinto del de "Otros" y de `sinDatos`. */
  empate: string;
  /** Tooltip invertido, como los tooltips de la UI (`bg-foreground`). */
  tooltipFondo: string;
  tooltipTexto: string;
  tooltipTextoSecundario: string;
}

export interface ChartTheme extends ColoresEstructura {
  modo: ThemeMode;
  otros: string;
  especial: (tipo: TipoVotoEspecial) => string;
}

const ESTRUCTURA: Record<ThemeMode, ColoresEstructura> = {
  light: {
    texto: "#0E1217",
    textoSecundario: "#5F636A",
    grilla: "#ECEBE8",
    borde: "#D5D4D0",
    superficie: "#FFFFFF",
    sinDatos: "#E7E6E2",
    empate: "#6B6F76",
    tooltipFondo: "#0E1217",
    tooltipTexto: "#F4F3F0",
    tooltipTextoSecundario: "#A7ABB1",
  },
  dark: {
    texto: "#F4F3F0",
    textoSecundario: "#9A9FA6",
    grilla: "#1E2229",
    borde: "#34383F",
    superficie: "#11151B",
    sinDatos: "#2A2E35",
    empate: "#A4A8AE",
    tooltipFondo: "#F4F3F0",
    tooltipTexto: "#0E1217",
    tooltipTextoSecundario: "#5A5E65",
  },
};

/** Paleta de las gráficas para el tema resuelto; cambia de identidad al alternar claro/oscuro. */
export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();

  return useMemo(
    () => ({
      ...ESTRUCTURA[resolvedTheme],
      modo: resolvedTheme,
      otros: colorOtros(resolvedTheme),
      especial: (tipo: TipoVotoEspecial) => colorVotoEspecial(tipo, resolvedTheme),
    }),
    [resolvedTheme],
  );
}
