"use client";

import { useMemo, useState } from "react";
import { normalizarBusqueda } from "@/lib/format";

export const FILAS_POR_PAGINA = 15;

interface Opciones<T> {
  /** Texto buscable de cada fila. Debe ser estable (definido fuera del componente). */
  textoBusqueda: (fila: T) => string;
  filasPorPagina?: number;
}

/** Búsqueda local sin tildes y paginación para tablas pequeñas ya cargadas en memoria. */
export function useTablaLocal<T>(filas: readonly T[], { textoBusqueda, filasPorPagina = FILAS_POR_PAGINA }: Opciones<T>) {
  const [busqueda, setBusquedaState] = useState("");
  const [paginaSolicitada, setPagina] = useState(0);

  const indice = useMemo(
    () => filas.map((fila) => ({ fila, texto: normalizarBusqueda(textoBusqueda(fila)) })),
    [filas, textoBusqueda],
  );

  const filtradas = useMemo(() => {
    const termino = normalizarBusqueda(busqueda);
    if (!termino) return filas;
    return indice.filter((item) => item.texto.includes(termino)).map((item) => item.fila);
  }, [busqueda, filas, indice]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / filasPorPagina));
  const pagina = Math.min(paginaSolicitada, totalPaginas - 1);
  const inicio = pagina * filasPorPagina;

  return {
    busqueda,
    setBusqueda: (valor: string) => {
      setBusquedaState(valor);
      setPagina(0);
    },
    filtradas,
    visibles: filtradas.slice(inicio, inicio + filasPorPagina),
    paginacion: {
      pagina,
      totalPaginas,
      total: filtradas.length,
      desde: filtradas.length === 0 ? 0 : inicio + 1,
      hasta: Math.min(inicio + filasPorPagina, filtradas.length),
    },
    setPagina,
  };
}
