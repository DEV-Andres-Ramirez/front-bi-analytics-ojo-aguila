"use client";

import { ChartBarBigIcon, ChartColumnStackedIcon, ChartPieIcon, ListChecksIcon, MapIcon } from "lucide-react";
import {
  ComposicionChart,
  DistribucionChart,
  MapaColombia,
  RankingChart,
  VotoListaChart,
} from "@/components/charts/lazy";
import type { ResultadosResponse } from "@/domain/types";
import type { ColoresCompetidores } from "@/hooks/use-colores-competidores";
import { ChartCard } from "./chart-card";
import { ETIQUETA_DIMENSION, etiquetasNivel } from "./etiquetas";

interface ChartsGridProps {
  response: ResultadosResponse;
  colores: ColoresCompetidores;
  onSelectCompetidor: (competidorId: string) => void;
  onNavegar: (codigo: string) => void;
}

export function ChartsGrid({ response, colores, onSelectCompetidor, onNavegar }: ChartsGridProps) {
  const { ambito, competidores, dimension, hijos, kpis, topIds, votoLista } = response;
  const etiqueta = ETIQUETA_DIMENSION[dimension];
  const hijosNivel = ambito.nivelHijos ? etiquetasNivel(ambito.nivelHijos) : null;
  const tieneHijos = hijosNivel !== null && hijos.length > 0;
  const esNacional = ambito.unidad.nivel === "nacional";
  const principales =
    topIds.length === 1 ? `del principal ${etiqueta.singular}` : `de los ${topIds.length} principales ${etiqueta.plural}`;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <ChartCard
        titulo={`Ranking de ${etiqueta.plural}`}
        descripcion={`Los ${etiqueta.plural} con más votos. Selecciona una barra para ver su detalle.`}
        icono={ChartBarBigIcon}
        altoClassName="h-[380px]"
        className="lg:col-span-3"
      >
        <RankingChart competidores={competidores} colores={colores} onSelect={onSelectCompetidor} />
      </ChartCard>

      <ChartCard
        titulo="Composición del voto"
        descripcion="Reparto de todos los votos depositados en el ámbito"
        icono={ChartPieIcon}
        altoClassName="h-[380px]"
        className="lg:col-span-2"
      >
        <ComposicionChart kpis={kpis} competidores={competidores} colores={colores} />
      </ChartCard>

      {tieneHijos && esNacional && (
        <ChartCard
          titulo="Mapa de ganadores por departamento"
          descripcion="Color del ganador en cada departamento. Selecciona uno para explorarlo."
          icono={MapIcon}
          altoClassName="h-[460px]"
          className="lg:col-span-2"
        >
          <MapaColombia unidades={hijos} competidores={competidores} colores={colores} onSelectDepartamento={onNavegar} />
        </ChartCard>
      )}

      {tieneHijos && (
        <ChartCard
          titulo="Distribución territorial"
          descripcion={`Participación ${principales} en cada ${hijosNivel.singular}`}
          icono={ChartColumnStackedIcon}
          altoClassName="h-[460px]"
          className={esNacional ? "lg:col-span-3" : "lg:col-span-5"}
        >
          <DistribucionChart
            unidades={hijos}
            topIds={topIds}
            competidores={competidores}
            colores={colores}
            onSelectUnidad={onNavegar}
          />
        </ChartCard>
      )}

      {votoLista && votoLista.length > 0 && (
        <ChartCard
          titulo="Voto por lista vs. voto preferente"
          descripcion="Votos solo por el partido frente a votos por sus candidatos"
          icono={ListChecksIcon}
          altoClassName="h-[400px]"
          className="lg:col-span-5"
        >
          <VotoListaChart partidos={votoLista} colores={colores} />
        </ChartCard>
      )}
    </div>
  );
}
