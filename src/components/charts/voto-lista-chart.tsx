"use client";

import { useMemo } from "react";
import type { ChartData, ChartOptions } from "chart.js";
import { Bar } from "react-chartjs-2";
import type { VotoListaPartido } from "@/domain/types";
import type { ColoresCompetidores } from "@/hooks/use-colores-competidores";
import { formatCompacto, formatNumero, formatPct } from "@/lib/format";
import { withAlpha } from "@/lib/palette";
import { ChartFrame, ChartVacio, Leyenda, LeyendaItem } from "./chart-frame";
import type { VotoListaChartProps } from "./chart-props";
import { registrarGraficas } from "./chart-setup";
import {
  claveTooltip,
  colorSegunResaltado,
  coloresTooltip,
  enumerar,
  etiquetaEje,
  huecoSegmento,
  valorApilado,
} from "./chart-utils";
import { AYUDA_TECLADO, indicePorCategoria, useChartInteraction } from "./use-chart-interaction";
import { useChartTheme } from "./use-chart-theme";

registrarGraficas();

const LIMITE_POR_DEFECTO = 10;
const FILAS_EN_RESUMEN = 3;
/** El voto solo por la lista es la variante tenue del color del partido. */
const ALFA_LISTA = 0.4;

type TipoVotoPartido = "preferente" | "lista";

const SERIES: { tipo: TipoVotoPartido; etiqueta: string; alfa: number }[] = [
  { tipo: "preferente", etiqueta: "Voto preferente", alfa: 1 },
  { tipo: "lista", etiqueta: "Solo por la lista", alfa: ALFA_LISTA },
];

interface FilaPartido {
  codPartido: string;
  nombre: string;
  preferente: number;
  lista: number;
  total: number;
  color: string;
}

function construirFilas(partidos: VotoListaPartido[], limite: number, colores: ColoresCompetidores): FilaPartido[] {
  return partidos
    .map((p) => ({
      codPartido: p.codPartido,
      nombre: p.nombre,
      preferente: p.votosPreferente,
      lista: p.votosLista,
      total: p.votosPreferente + p.votosLista,
      color: colores.partido(p.codPartido),
    }))
    .filter((f) => f.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limite);
}

function describirFila(fila: FilaPartido): string {
  return `${fila.nombre}: ${formatPct(fila.preferente / fila.total)} preferente y ${formatPct(fila.lista / fila.total)} solo por la lista`;
}

function resumir(filas: FilaPartido[]): string {
  const partes = filas.slice(0, FILAS_EN_RESUMEN).map(describirFila);
  const partidos = filas.length === 1 ? "el partido" : `los ${formatNumero(filas.length)} partidos`;
  return `Voto preferente frente a voto solo por la lista en ${partidos} con más votos. ${enumerar(partes)}. ${AYUDA_TECLADO}`;
}

export function VotoListaChart({ partidos, colores, limite = LIMITE_POR_DEFECTO }: VotoListaChartProps) {
  const tema = useChartTheme();
  const filas = useMemo(() => construirFilas(partidos, limite, colores), [partidos, limite, colores]);

  const datos = useMemo<ChartData<"bar", (number | null)[], string>>(
    () => ({
      labels: filas.map((f) => f.nombre),
      datasets: SERIES.map(({ tipo, etiqueta, alfa }) => ({
        label: etiqueta,
        data: filas.map((f) => valorApilado(f[tipo])),
        backgroundColor: (ctx) => colorSegunResaltado(ctx.chart, ctx.dataIndex, filas[ctx.dataIndex]?.color ?? tema.otros, alfa),
        borderSkipped: "middle",
        inflateAmount: huecoSegmento,
        maxBarThickness: 20,
        categoryPercentage: 0.8,
        barPercentage: 1,
      })),
    }),
    [filas, tema],
  );

  const opciones = useMemo<ChartOptions<"bar">>(
    () => ({
      indexAxis: "y",
      events: [],
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          border: { display: false },
          grid: { color: tema.grilla, drawTicks: false },
          ticks: {
            maxTicksLimit: 5,
            padding: 6,
            color: tema.textoSecundario,
            font: { size: 11 },
            callback: (valor) => formatCompacto(Number(valor)),
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
              return etiquetaEje(this, filas[indice]?.nombre ?? "");
            },
          },
        },
      },
      plugins: {
        tooltip: {
          ...coloresTooltip(tema),
          filter: (item) => typeof item.raw === "number",
          callbacks: {
            title: (items) => filas[items[0]?.dataIndex ?? -1]?.nombre ?? "",
            label: (item) => {
              const fila = filas[item.dataIndex];
              const serie = SERIES[item.datasetIndex];
              if (!fila || !serie) return "";
              const votos = fila[serie.tipo];
              return `${formatPct(votos / fila.total)} · ${serie.etiqueta} (${formatNumero(votos)})`;
            },
            labelColor: (item) => {
              const color = filas[item.dataIndex]?.color ?? tema.otros;
              return claveTooltip(item.datasetIndex === 0 ? color : withAlpha(color, ALFA_LISTA));
            },
            footer: (items) => {
              const fila = filas[items[0]?.dataIndex ?? -1];
              return fila ? `${formatNumero(fila.total)} votos del partido` : "";
            },
          },
        },
      },
    }),
    [filas, tema],
  );

  const { chartRef, propsMarco } = useChartInteraction<"bar", (number | null)[], string>({
    total: filas.length,
    datos,
    indiceEnEvento: indicePorCategoria("y"),
    describir: (indice) => (filas[indice] ? describirFila(filas[indice]) : ""),
  });

  if (filas.length === 0) return <ChartVacio />;

  return (
    <div className="flex size-full min-h-0 flex-col gap-3">
      <Leyenda aria-label="Leyenda del tipo de voto">
        {SERIES.map(({ tipo, etiqueta, alfa }) => (
          <LeyendaItem key={tipo} color={withAlpha(tema.textoSecundario, alfa)} etiqueta={etiqueta} />
        ))}
      </Leyenda>
      <ChartFrame etiqueta={resumir(filas)} className="flex-1" {...propsMarco}>
        <Bar ref={chartRef} data={datos} options={opciones} aria-hidden />
      </ChartFrame>
    </div>
  );
}
