"use client";

import { useMemo } from "react";
import type { ChartData, ChartOptions } from "chart.js";
import { Bar } from "react-chartjs-2";
import type { Competidor } from "@/domain/types";
import type { ColoresCompetidores } from "@/hooks/use-colores-competidores";
import { formatCantidad, formatNumero, formatPct } from "@/lib/format";
import { ChartFrame, ChartVacio } from "./chart-frame";
import { etiquetaFinalBarra } from "./chart-plugins";
import type { RankingChartProps } from "./chart-props";
import { registrarGraficas } from "./chart-setup";
import {
  claveTooltip,
  colorSegunResaltado,
  coloresTooltip,
  enumerar,
  etiquetaEje,
  esVistaPartidos,
} from "./chart-utils";
import { AYUDA_SELECCION, AYUDA_TECLADO, indicePorCategoria, useChartInteraction } from "./use-chart-interaction";
import { useChartTheme, type ChartTheme } from "./use-chart-theme";

registrarGraficas();

const LIMITE_POR_DEFECTO = 10;
const FILAS_EN_RESUMEN = 3;
const ESPACIO_ETIQUETA_PX = 56;

const PLUGINS = [etiquetaFinalBarra];

interface FilaRanking {
  id: string | null;
  nombre: string;
  detalle: string;
  votos: number;
  pct: number;
  color: string;
}

function construirFilas(
  competidores: Competidor[],
  limite: number,
  colores: ColoresCompetidores,
  tema: ChartTheme,
): FilaRanking[] {
  // Agrupar un único competidor restante no aporta: se muestra con su nombre.
  const corte = competidores.length === limite + 1 ? competidores.length : limite;
  const filas: FilaRanking[] = competidores.slice(0, corte).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    detalle: c.detalle,
    votos: c.votos,
    pct: c.pctValidos,
    color: colores.competidor(c.id),
  }));
  const resto = competidores.slice(corte);
  if (resto.length === 0) return filas;

  const detalle = esVistaPartidos(competidores)
    ? formatCantidad(resto.length, "partido", "partidos")
    : formatCantidad(resto.length, "candidato", "candidatos");
  filas.push({
    id: null,
    nombre: `Otros (${formatNumero(resto.length)})`,
    detalle: `${detalle} con menos votos`,
    votos: resto.reduce((total, c) => total + c.votos, 0),
    pct: resto.reduce((total, c) => total + c.pctValidos, 0),
    color: tema.otros,
  });
  return filas;
}

function resumir(filas: FilaRanking[], interactivo: boolean): string {
  const principales = filas
    .filter((f) => f.id !== null)
    .slice(0, FILAS_EN_RESUMEN)
    .map((f, i) => `${i + 1}. ${f.nombre}, ${formatPct(f.pct)}`);
  const ayuda = interactivo ? AYUDA_SELECCION : AYUDA_TECLADO;
  return `Ranking por porcentaje de votos válidos: ${enumerar(principales)}. ${ayuda}`;
}

export function RankingChart({ competidores, colores, limite = LIMITE_POR_DEFECTO, onSelect }: RankingChartProps) {
  const tema = useChartTheme();
  const filas = useMemo(
    () => construirFilas(competidores, limite, colores, tema),
    [competidores, limite, colores, tema],
  );

  const datos = useMemo<ChartData<"bar", number[], string>>(
    () => ({
      labels: filas.map((f) => f.nombre),
      datasets: [
        {
          label: "Votos válidos",
          data: filas.map((f) => f.pct),
          backgroundColor: (ctx) => colorSegunResaltado(ctx.chart, ctx.dataIndex, filas[ctx.dataIndex]?.color ?? tema.otros),
          maxBarThickness: 22,
          categoryPercentage: 0.8,
          barPercentage: 0.9,
        },
      ],
    }),
    [filas, tema],
  );

  const opciones = useMemo<ChartOptions<"bar">>(
    () => ({
      indexAxis: "y",
      events: [],
      layout: { padding: { right: ESPACIO_ETIQUETA_PX } },
      scales: {
        x: { display: false, beginAtZero: true },
        y: {
          border: { display: false },
          grid: { display: false },
          ticks: {
            autoSkip: false,
            padding: 8,
            color: (ctx) => (filas[ctx.index]?.id === null ? tema.textoSecundario : tema.texto),
            font: { size: 12, weight: 500 },
            callback(_valor, indice) {
              return etiquetaEje(this, filas[indice]?.nombre ?? "", ESPACIO_ETIQUETA_PX);
            },
          },
        },
      },
      plugins: {
        etiquetaFinalBarra: { color: tema.texto },
        tooltip: {
          ...coloresTooltip(tema),
          callbacks: {
            title: ([item]) => filas[item.dataIndex]?.nombre ?? "",
            label: (item) => {
              const fila = filas[item.dataIndex];
              return fila ? `${formatPct(fila.pct)} · ${formatNumero(fila.votos)} votos` : "";
            },
            labelColor: (item) => claveTooltip(filas[item.dataIndex]?.color ?? tema.otros),
            footer: ([item]) => filas[item.dataIndex]?.detalle ?? "",
          },
        },
      },
    }),
    [filas, tema],
  );

  const { chartRef, propsMarco } = useChartInteraction<"bar", number[], string>({
    total: filas.length,
    datos,
    indiceEnEvento: indicePorCategoria("y"),
    describir: (indice) => {
      const fila = filas[indice];
      return fila ? `${fila.nombre}: ${formatPct(fila.pct)}, ${formatNumero(fila.votos)} votos` : "";
    },
    esSeleccionable: (indice) => Boolean(filas[indice]?.id),
    onSeleccionar: onSelect
      ? (indice) => {
          const id = filas[indice]?.id;
          if (id) onSelect(id);
        }
      : undefined,
  });

  if (filas.length === 0) return <ChartVacio />;

  return (
    <ChartFrame etiqueta={resumir(filas, Boolean(onSelect))} {...propsMarco}>
      <Bar ref={chartRef} data={datos} options={opciones} plugins={PLUGINS} aria-hidden />
    </ChartFrame>
  );
}
