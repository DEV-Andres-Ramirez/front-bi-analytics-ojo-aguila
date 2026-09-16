"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { esCodigoGeoValido } from "@/domain/niveles";
import type { Dimension, EleccionRef } from "@/domain/types";
import { dimensionEfectiva } from "@/domain/votos";

/** Parámetros de URL: t = tipificación, c = corporación, a = año, g = código geográfico, d = dimensión. */
type Param = "t" | "c" | "a" | "g" | "d";

export interface FiltrosUrl {
  tipificacion: string | null;
  corporacion: string | null;
  periodo: string | null;
  /** Código geográfico actual ("" = Colombia). */
  codigo: string;
  /** Elección completa (los 3 filtros) o null. */
  eleccion: EleccionRef | null;
  /** Dimensión efectiva (la de la URL si es válida, si no la por defecto de la elección). */
  dimension: Dimension | null;
}

/**
 * Estado del dashboard sincronizado con la URL (compartible, back/forward).
 * Requiere un <Suspense> ancestro por `useSearchParams`.
 */
export function useFiltrosUrl() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const filtros = useMemo<FiltrosUrl>(() => {
    const tipificacion = searchParams.get("t");
    const corporacion = searchParams.get("c");
    const periodo = searchParams.get("a");
    const g = searchParams.get("g") ?? "";
    const codigo = esCodigoGeoValido(g) ? g : "";
    const eleccion = tipificacion && corporacion && periodo ? { tipificacion, corporacion, periodo } : null;

    let dimension: Dimension | null = null;
    if (eleccion) {
      const d = searchParams.get("d");
      const pedida = d === "candidato" || d === "partido" ? d : null;
      dimension = dimensionEfectiva(eleccion, codigo, pedida);
    }
    return { tipificacion, corporacion, periodo, codigo, eleccion, dimension };
  }, [searchParams]);

  /**
   * History API nativa: Next sincroniza useSearchParams sin ir al servidor, así la cascada de
   * filtros y el drill-down son instantáneos (los datos llegan por TanStack Query).
   */
  const update = useCallback(
    (changes: Partial<Record<Param, string | null>>, mode: "push" | "replace" = "push") => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      const url = query ? `${pathname}?${query}` : pathname;
      if (mode === "replace") window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
    },
    [pathname, searchParams],
  );

  return {
    ...filtros,
    /** Cambiar tipificación reinicia corporación, año y dimensión. */
    setTipificacion: useCallback((t: string) => update({ t, c: null, a: null, d: null }), [update]),
    /** Cambiar corporación reinicia año y dimensión. */
    setCorporacion: useCallback((c: string) => update({ c, a: null, d: null }), [update]),
    setPeriodo: useCallback((a: string) => update({ a }), [update]),
    /** Navega a un ámbito geográfico (se conserva al cambiar de elección). */
    setCodigo: useCallback(
      (g: string, mode: "push" | "replace" = "push") => update({ g: g || null }, mode),
      [update],
    ),
    setDimension: useCallback((d: Dimension) => update({ d }, "replace"), [update]),
    limpiar: useCallback(() => window.history.pushState(null, "", pathname), [pathname]),
  };
}
