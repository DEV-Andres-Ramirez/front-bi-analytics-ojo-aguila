"use client";

import { useSeleccionEleccion } from "@/components/header/use-seleccion-eleccion";
import type { Catalogo } from "@/domain/types";
import { EleccionNoDisponible, EmptyState } from "./empty-state";
import { ResultadosView } from "./resultados-view";

/** Orquesta el tablero según los filtros de la URL. Requiere un <Suspense> ancestro. */
export function DashboardView({ catalogo }: { catalogo: Catalogo }) {
  // Validados contra el catálogo, igual que el stepper del header: ambos indicadores coinciden.
  const { seleccion, eleccion, dimension, codigo, limpiar, setCodigo, setDimension } = useSeleccionEleccion(catalogo);

  if (!eleccion || !dimension) {
    return (
      <EmptyState
        catalogo={catalogo}
        tipificacion={seleccion.tipificacion}
        corporacion={seleccion.corporacion}
        periodo={seleccion.periodo}
        codigo={codigo}
      />
    );
  }

  if (seleccion.periodo === null) {
    return <EleccionNoDisponible eleccion={eleccion} onLimpiar={limpiar} />;
  }

  return (
    <ResultadosView
      eleccion={eleccion}
      codigo={codigo}
      dimension={dimension}
      onNavegar={setCodigo}
      onDimensionChange={setDimension}
    />
  );
}
