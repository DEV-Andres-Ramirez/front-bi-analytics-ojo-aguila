"use client";

import { useMemo } from "react";
import type { ChartData, ChartOptions } from "chart.js";
import { Bar } from "react-chartjs-2";
import type { Competidor, UnidadResultado } from "@/domain/types";
import type { ColoresCompetidores } from "@/hooks/use-colores-competidores";
import { formatCantidad, formatNumero, formatPct } from "@/lib/format";
import { ChartFrame, ChartVacio, Leyenda, LeyendaItem } from "./chart-frame";
import type { DistribucionChartProps } from "./chart-props";
import { registrarGraficas } from "./chart-setup";
import {
  claveTooltip,
  colorSegunResaltado,
  coloresTooltip,
  enumerar,
  etiquetaEje,
  formatPctEje,
  huecoSegmento,
  valorApilado,
} from "./chart-utils";
import { AYUDA_SELECCION, AYUDA_TECLADO, indicePorCategoria, useChartInteraction } from "./use-chart-interaction";
import { useChartTheme, type ChartTheme } from "./use-chart-theme";

registrarGraficas();

const LIMITE_POR_DEFECTO = 15;
const FILAS_EN_RESUMEN = 3;
const ID_OTROS = "otros";
const TEXTO_EMPATE = "Empate en el primer lugar";

interface Serie {
  id: string;
  etiqueta: string;
  color: string;
  votos: number[];
  pct: number[];
}

interface Distribucion {
  unidades: UnidadResultado[];
  series: Serie[];
}

function construirDistribucion(
  unidades: UnidadResultado[],
  topIds: string[],
  competidores: Competidor[],
  limite: number,
  colores: ColoresCompetidores,
  tema: ChartTheme,
): Distribucion {
  const filas = [...unidades].sort((a, b) => b.totalVotos - a.totalVotos).slice(0, limite);
  const porId = new Map(competidores.map((c) => [c.id, c]));
  const proporcion = (votos: number, fila: number) =>
    filas[fila].votosValidos > 0 ? votos / filas[fila].votosValidos : 0;

  const principales = topIds.map((id) => {
    const votos = filas.map((u) => u.top[id] ?? 0);
    return {
      id,
      etiqueta: porId.get(id)?.nombre ?? id,
      color: colores.competidor(id),
      votos,
      pct: votos.map(proporcion),
    };
  });

  const votosResto = filas.map((u, fila) =>
    Math.max(u.votosValidos - principales.reduce((suma, serie) => suma + serie.votos[fila], 0), 0),
  );
  const resto: Serie = {
    id: ID_OTROS,
    etiqueta: "Otros y voto en blanco",
    color: tema.otros,
    votos: votosResto,
    pct: votosResto.map(proporcion),
  };

  return { unidades: filas, series: votosResto.some((v) => v > 0) ? [...principales, resto] : principales };
}

function resumir({ unidades, series }: Distribucion, interactivo: boolean): string {
  const lideres = unidades.slice(0, FILAS_EN_RESUMEN).map((unidad, fila) => {
    if (unidad.empate) return `${unidad.unidad.nombre}: ${TEXTO_EMPATE.toLowerCase()}`;
    const lider = series
      .filter((s) => s.id !== ID_OTROS)
      .reduce<Serie | null>((mejor, s) => (!mejor || s.pct[fila] > mejor.pct[fila] ? s : mejor), null);
    return lider ? `${unidad.unidad.nombre}: ${lider.etiqueta} ${formatPct(lider.pct[fila])}` : unidad.unidad.nombre;
  });
  const ayuda = interactivo ? AYUDA_SELECCION : AYUDA_TECLADO;
  return `Participación de los principales competidores en ${formatCantidad(unidades.length, "unidad", "unidades")}, sobre votos válidos. ${enumerar(lideres)}. ${ayuda}`;
}

/** Participación de cada serie con votos en una fila, como en el tooltip. */
function describirFila({ unidades, series }: Distribucion, fila: number): string {
  const unidad = unidades[fila];
  if (!unidad) return "";
  const partes = series
    .filter((serie) => serie.votos[fila] > 0)
    .map((serie) => `${serie.etiqueta} ${formatPct(serie.pct[fila])}`);
  const empate = unidad.empate ? `. ${TEXTO_EMPATE}` : "";
  return `${unidad.unidad.nombre}: ${partes.join(", ")}${empate}`;
}

export function DistribucionChart({
  unidades,
  topIds,
  competidores,
  colores,
  limiteUnidades = LIMITE_POR_DEFECTO,
  onSelectUnidad,
}: DistribucionChartProps) {
  const tema = useChartTheme();
  const distribucion = useMemo(
    () => construirDistribucion(unidades, topIds, competidores, limiteUnidades, colores, tema),
    [unidades, topIds, competidores, limiteUnidades, colores, tema],
  );
  const { unidades: filas, series } = distribucion;

  const datos = useMemo<ChartData<"bar", (number | null)[], string>>(
    () => ({
      labels: filas.map((u) => u.unidad.nombre),
      datasets: series.map((serie) => ({
        label: serie.id,
        data: serie.pct.map(valorApilado),
        backgroundColor: (ctx) => colorSegunResaltado(ctx.chart, ctx.dataIndex, serie.color),
        borderSkipped: "middle",
        inflateAmount: huecoSegmento,
        maxBarThickness: 20,
        categoryPercentage: 0.82,
        barPercentage: 1,
      })),
    }),
    [filas, series],
  );

  const opciones = useMemo<ChartOptions<"bar">>(
    () => ({
      indexAxis: "y",
      events: [],
      scales: {
        x: {
          stacked: true,
          min: 0,
          max: 1,
          border: { display: false },
          grid: { color: tema.grilla, drawTicks: false },
          ticks: {
            stepSize: 0.25,
            padding: 6,
            color: tema.textoSecundario,
            font: { size: 11 },
            callback: (valor) => formatPctEje(Number(valor)),
          },
        },
        y: {
          stacked: true,
          border: { display: false },
          grid: { display: false },
          ticks: {
            autoSkip: false,
            padding: 8,
            color: tema.texto,
            callback(_valor, indice) {
              return etiquetaEje(this, filas[indice]?.unidad.nombre ?? "");
            },
          },
        },
      },
      plugins: {
        tooltip: {
          ...coloresTooltip(tema),
          filter: (item) => (series[item.datasetIndex]?.votos[item.dataIndex] ?? 0) > 0,
          callbacks: {
            title: (items) => filas[items[0]?.dataIndex ?? -1]?.unidad.nombre ?? "",
            label: (item) => {
              const serie = series[item.datasetIndex];
              if (!serie) return "";
              const fila = item.dataIndex;
              return `${formatPct(serie.pct[fila])} · ${serie.etiqueta} (${formatNumero(serie.votos[fila])})`;
            },
            labelColor: (item) => claveTooltip(series[item.datasetIndex]?.color ?? tema.otros),
            footer: (items) => {
              const unidad = filas[items[0]?.dataIndex ?? -1];
              if (!unidad) return "";
              const validos = `${formatNumero(unidad.votosValidos)} votos válidos`;
              return unidad.empate ? `${TEXTO_EMPATE} · ${validos}` : validos;
            },
          },
        },
      },
    }),
    [filas, series, tema],
  );

  const { chartRef, propsMarco } = useChartInteraction<"bar", (number | null)[], string>({
    total: filas.length,
    datos,
    indiceEnEvento: indicePorCategoria("y"),
    describir: (fila) => describirFila(distribucion, fila),
    onSeleccionar: onSelectUnidad
      ? (indice) => {
          const unidad = filas[indice];
          if (unidad) onSelectUnidad(unidad.unidad.codigo);
        }
      : undefined,
  });

  if (filas.length === 0 || series.length === 0) return <ChartVacio />;

  return (
    <div className="flex size-full min-h-0 flex-col gap-3">
      <Leyenda aria-label="Leyenda de competidores">
        {series.map((serie) => (
          <LeyendaItem key={serie.id} color={serie.color} etiqueta={serie.etiqueta} className="max-w-56" />
        ))}
      </Leyenda>
      <ChartFrame etiqueta={resumir(distribucion, Boolean(onSelectUnidad))} className="flex-1" {...propsMarco}>
        <Bar ref={chartRef} data={datos} options={opciones} aria-hidden />
      </ChartFrame>
    </div>
  );
}
