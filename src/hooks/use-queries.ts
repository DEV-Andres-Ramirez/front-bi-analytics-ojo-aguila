"use client";

import { hashKey, keepPreviousData, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import type { Dimension, EleccionRef } from "@/domain/types";
import { fetchDetalleCompetidor, fetchGeografia, fetchResultados } from "@/lib/api-client";

export const queryKeys = {
  resultados: (eleccion: EleccionRef, codigo: string, dimension: Dimension) =>
    ["resultados", eleccion.tipificacion, eleccion.corporacion, eleccion.periodo, codigo, dimension] as const,
  competidor: (eleccion: EleccionRef, codigo: string, dimension: Dimension, competidorId: string) =>
    ["competidor", eleccion.tipificacion, eleccion.corporacion, eleccion.periodo, codigo, dimension, competidorId] as const,
  geografia: ["geografia"] as const,
};

/** Resultados del ámbito. Mantiene la vista anterior mientras carga la nueva (`isPlaceholderData`). */
export function useResultados(eleccion: EleccionRef | null, codigo: string, dimension: Dimension | null) {
  return useQuery({
    queryKey: eleccion && dimension ? queryKeys.resultados(eleccion, codigo, dimension) : ["resultados", "inactivo"],
    queryFn: ({ signal }) => fetchResultados(eleccion!, codigo, dimension!, signal),
    enabled: Boolean(eleccion && dimension),
    placeholderData: keepPreviousData,
  });
}

export function useDetalleCompetidor(
  eleccion: EleccionRef | null,
  codigo: string,
  dimension: Dimension | null,
  competidorId: string | null,
) {
  const enabled = Boolean(eleccion && dimension && competidorId);
  return useQuery({
    queryKey: enabled
      ? queryKeys.competidor(eleccion!, codigo, dimension!, competidorId!)
      : ["competidor", "inactivo"],
    queryFn: ({ signal }) => fetchDetalleCompetidor(eleccion!, codigo, dimension!, competidorId!, signal),
    enabled,
  });
}

/** Índice geográfico para el buscador ⌘K (se carga solo cuando `enabled`). */
export function useGeografia(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.geografia,
    queryFn: ({ signal }) => fetchGeografia(signal),
    enabled,
  });
}

/**
 * Precarga resultados de un ámbito (p. ej. al detenerse sobre una fila). Cada precarga cancela la
 * anterior si sigue descargando y nadie la muestra, para no acumular respuestas que no se verán.
 */
export function usePrefetchResultados() {
  const queryClient = useQueryClient();
  const anteriorRef = useRef<QueryKey | null>(null);

  return useCallback(
    (eleccion: EleccionRef, codigo: string, dimension: Dimension) => {
      const queryKey = queryKeys.resultados(eleccion, codigo, dimension);
      const anterior = anteriorRef.current;
      if (anterior && hashKey(anterior) !== hashKey(queryKey)) {
        const query = queryClient.getQueryCache().find({ queryKey: anterior, exact: true });
        if (query?.state.fetchStatus === "fetching" && query.getObserversCount() === 0) {
          void queryClient.cancelQueries({ queryKey: anterior, exact: true });
        }
      }
      anteriorRef.current = queryKey;
      return queryClient.prefetchQuery({
        queryKey,
        queryFn: ({ signal }) => fetchResultados(eleccion, codigo, dimension, signal),
      });
    },
    [queryClient],
  );
}
