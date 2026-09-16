"use client";

import { useMemo } from "react";
import { useTheme } from "@/components/theme/use-theme";
import type { ResultadosResponse, UnidadResultado } from "@/domain/types";
import { colorCompetidor, colorOtros, PALETTE_SIZE } from "@/lib/palette";

/** Competidor o partido con su índice de color del ranking nacional de la elección. */
interface ConColorNacional {
  id: string;
  colorIndex: number;
}

/** Colores de una respuesta de resultados: los mismos en gráficas, mapa, tablas, KPI y detalle. */
export interface ColoresCompetidores {
  /** Color de un competidor del ámbito; los que no alcanzan color propio usan el neutro de "Otros". */
  competidor: (id: string) => string;
  /** Color de un partido del voto por lista (en la dimensión partido coincide con `competidor`). */
  partido: (codPartido: string) => string;
}

interface IndicesColor {
  competidores: ReadonlyMap<string, number>;
  partidos: ReadonlyMap<string, number>;
}

/** Ganadores de las unidades (los empates no cuentan), del que gana más unidades al que menos. */
export function ganadoresPorUnidades(unidades: readonly UnidadResultado[]): { id: string; unidades: number }[] {
  const conteo = new Map<string, number>();
  for (const { ganador, empate } of unidades) {
    if (ganador && !empate) conteo.set(ganador.id, (conteo.get(ganador.id) ?? 0) + 1);
  }
  return [...conteo].map(([id, total]) => ({ id, unidades: total })).sort((a, b) => b.unidades - a.unidades);
}

/**
 * Reparte la paleta entre los primeros `PALETTE_SIZE` ids distintos de `prioridad`. Cada uno conserva
 * su color nacional si está en la paleta y nadie lo tomó; los demás reciben el primer color libre.
 * Así dos ids con color nunca lo comparten y el neutro queda para lo que no alcanza.
 */
export function asignarIndicesColor(prioridad: readonly ConColorNacional[]): Map<string, number> {
  const elegidos = new Map<string, number>();
  for (const { id, colorIndex } of prioridad) {
    if (elegidos.size === PALETTE_SIZE) break;
    if (!elegidos.has(id)) elegidos.set(id, colorIndex);
  }

  const indices = new Map<string, number>();
  const usados = new Set<number>();
  for (const [id, colorIndex] of elegidos) {
    if (colorIndex >= 0 && colorIndex < PALETTE_SIZE && !usados.has(colorIndex)) {
      indices.set(id, colorIndex);
      usados.add(colorIndex);
    }
  }
  let libre = 0;
  for (const id of elegidos.keys()) {
    if (indices.has(id)) continue;
    while (usados.has(libre)) libre += 1;
    indices.set(id, libre);
    usados.add(libre);
  }
  return indices;
}

/**
 * Prioridad de color: los principales del ámbito (dona y distribución), los ganadores del mapa
 * nacional (que solo se distinguen por color) y después el orden del ranking.
 */
export function asignarColores(response: ResultadosResponse): IndicesColor {
  const { ambito, competidores, dimension, hijos, topIds, votoLista } = response;
  const porId = new Map(competidores.map((competidor) => [competidor.id, competidor]));
  const ganadoresMapa = ambito.unidad.nivel === "nacional" ? ganadoresPorUnidades(hijos).map((g) => g.id) : [];
  const prioridad = [...topIds, ...ganadoresMapa].flatMap((id) => porId.get(id) ?? []).concat(competidores);

  const indicesCompetidores = asignarIndicesColor(prioridad);
  return {
    competidores: indicesCompetidores,
    partidos:
      dimension === "partido"
        ? indicesCompetidores
        : asignarIndicesColor((votoLista ?? []).map((p) => ({ id: p.codPartido, colorIndex: p.colorIndex }))),
  };
}

const SIN_COLORES: IndicesColor = { competidores: new Map(), partidos: new Map() };

/** Resolver de colores de la respuesta para el tema activo (sin respuesta, todo es neutro). */
export function useColoresCompetidores(response: ResultadosResponse | undefined): ColoresCompetidores {
  const { resolvedTheme } = useTheme();
  const indices = useMemo(() => (response ? asignarColores(response) : SIN_COLORES), [response]);

  return useMemo(() => {
    const resolver = (asignados: ReadonlyMap<string, number>) => (id: string) => {
      const indice = asignados.get(id);
      return indice === undefined ? colorOtros(resolvedTheme) : colorCompetidor(indice, resolvedTheme);
    };
    return { competidor: resolver(indices.competidores), partido: resolver(indices.partidos) };
  }, [indices, resolvedTheme]);
}
