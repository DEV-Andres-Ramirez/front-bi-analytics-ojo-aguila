"use client";

import { ArrowUpIcon, CompassIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { precargarGraficas } from "@/components/charts/lazy";
import { Button } from "@/components/ui/button";
import { codigoPadre } from "@/domain/niveles";
import type { Dimension, EleccionRef, ResultadosResponse } from "@/domain/types";
import { useColoresCompetidores } from "@/hooks/use-colores-competidores";
import { useResultados } from "@/hooks/use-queries";
import { cn } from "@/lib/utils";
import { ChartsGrid } from "./charts-grid";
import { CompetidorSheet } from "./competidor-sheet";
import { CompetidoresTable } from "./competidores-table";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { ElectionTitle } from "./election-title";
import { FetchingBar } from "./fetching-bar";
import { GeoBreadcrumb } from "./geo-breadcrumb";
import { KpiGrid } from "./kpi-grid";
import { esSinResultados, QueryError } from "./query-error";
import { TerritorialTable } from "./territorial-table";

interface SeleccionCompetidor {
  competidorId: string;
  /** Resultados en los que se abrió el detalle: al cambiar de ámbito la selección caduca. */
  clave: string;
  abierto: boolean;
}

function claveDeResultados({ eleccion, ambito, dimension }: ResultadosResponse): string {
  return [eleccion.tipificacion, eleccion.corporacion, eleccion.periodo, ambito.unidad.codigo, dimension].join("|");
}

interface ResultadosViewProps {
  eleccion: EleccionRef;
  codigo: string;
  dimension: Dimension;
  onNavegar: (codigo: string) => void;
  onDimensionChange: (dimension: Dimension) => void;
}

export function ResultadosView({ eleccion, codigo, dimension, onNavegar, onDimensionChange }: ResultadosViewProps) {
  const resultados = useResultados(eleccion, codigo, dimension);
  const colores = useColoresCompetidores(resultados.data);
  const [seleccion, setSeleccion] = useState<SeleccionCompetidor | null>(null);
  const inicioRef = useRef<HTMLDivElement>(null);
  /** Elemento que abrió el detalle del competidor: recupera el foco al cerrarlo. */
  const origenDetalleRef = useRef<HTMLElement | null>(null);

  useEffect(() => precargarGraficas(), []);

  if (resultados.isPending) return <DashboardSkeleton />;

  if (resultados.isError) {
    const padre = esSinResultados(resultados.error) ? codigoPadre(codigo) : null;
    return (
      <QueryError
        error={resultados.error}
        onRetry={() => void resultados.refetch()}
        reintentando={resultados.isFetching}
        tituloSinResultados="Este lugar no tiene resultados"
        className="flex-1"
      >
        {padre && (
          <Button variant="outline" onClick={() => onNavegar(padre)}>
            <ArrowUpIcon aria-hidden />
            Subir un nivel
          </Button>
        )}
        {codigo && (
          <Button variant="outline" onClick={() => onNavegar("")}>
            <CompassIcon aria-hidden />
            Ver resultados nacionales
          </Button>
        )}
      </QueryError>
    );
  }

  const response = resultados.data;
  const clave = claveDeResultados(response);
  const actualizando = resultados.isFetching || resultados.isPlaceholderData;
  // El ámbito cambió sin cerrar el detalle (atrás/adelante, ⌘K): la selección no debe revivir al volver.
  if (seleccion && seleccion.clave !== clave) setSeleccion(null);
  const seleccionVigente = seleccion?.clave === clave ? seleccion : null;

  const navegar = (destino: string) => {
    onNavegar(destino);
    const inicio = inicioRef.current;
    if (inicio && inicio.getBoundingClientRect().top < 0) {
      const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      inicio.scrollIntoView({ behavior: sinMovimiento ? "auto" : "smooth", block: "start" });
    }
  };

  const abrirCompetidor = (competidorId: string) => {
    origenDetalleRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSeleccion({ competidorId, clave, abierto: true });
  };

  /** El panel no tiene disparador propio: sin esto, Radix deja el foco en <body> al cerrarlo. */
  const restaurarFoco = (evento: Event) => {
    evento.preventDefault();
    const origen = origenDetalleRef.current;
    const destino = origen && origen !== document.body && origen.isConnected ? origen : inicioRef.current;
    destino?.focus({ preventScroll: true });
  };

  return (
    <>
      <FetchingBar activo={actualizando} />
      <div
        ref={inicioRef}
        tabIndex={-1}
        aria-busy={actualizando}
        className={cn(
          "flex scroll-mt-[calc(var(--app-header-height,4.25rem)+1rem)] flex-col gap-6 outline-none transition-opacity duration-300",
          actualizando && "opacity-60",
        )}
      >
        <header className="flex flex-col gap-4">
          <ElectionTitle
            eleccion={response.eleccion}
            unidad={response.ambito.unidad}
            dimension={dimension}
            onDimensionChange={onDimensionChange}
          />
          <GeoBreadcrumb ruta={response.ambito.ruta} onNavegar={navegar} />
        </header>

        <KpiGrid kpis={response.kpis} competidores={response.competidores} colores={colores} />

        <div key={clave} className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <ChartsGrid response={response} colores={colores} onSelectCompetidor={abrirCompetidor} onNavegar={navegar} />
          <TerritorialTable response={response} colores={colores} onNavegar={navegar} />
          <CompetidoresTable response={response} colores={colores} onSelect={abrirCompetidor} />
        </div>
      </div>

      <CompetidorSheet
        response={response}
        colores={colores}
        competidorId={seleccionVigente?.competidorId ?? null}
        open={seleccionVigente?.abierto ?? false}
        onOpenChange={(abierto) => setSeleccion((actual) => actual && { ...actual, abierto })}
        onCloseAutoFocus={restaurarFoco}
        onNavegar={navegar}
      />
    </>
  );
}
