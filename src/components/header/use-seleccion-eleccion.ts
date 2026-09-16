"use client";

import { useMemo } from "react";
import type { Catalogo } from "@/domain/types";
import { useFiltrosUrl } from "@/hooks/use-filtros-url";
import { resolverSeleccion } from "./seleccion-eleccion";

/** Filtros de la URL validados contra el catálogo. Requiere un <Suspense> ancestro. */
export function useSeleccionEleccion(catalogo: Catalogo) {
  const filtros = useFiltrosUrl();
  const { tipificacion, corporacion, periodo } = filtros;

  const seleccion = useMemo(
    () => resolverSeleccion(catalogo, { tipificacion, corporacion, periodo }),
    [catalogo, tipificacion, corporacion, periodo],
  );

  return { ...filtros, seleccion };
}
