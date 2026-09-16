"use client";

import { useMemo } from "react";
import type { ChartData, ChartOptions } from "chart.js";
import { Bar } from "react-chartjs-2";
import type { DetalleCompetidorResponse } from "@/domain/types";
import { formatCantidad, formatCompacto, formatNumero, formatPct } from "@/lib/format";
import { withAlpha } from "@/lib/palette";
import { ChartFrame, ChartVacio, Leyenda, LeyendaItem } from "./chart-frame";
import type { DesempenoCompetidorChartProps } from "./chart-props";
import { registrarGraficas } from "./chart-setup";
import {
  claveTooltip,
  colorSegunResaltado,
  coloresTooltip,
  etiquetaEje,
  formatPctEje,
} from "./chart-utils";
import { AYUDA_SELECCION, AYUDA_TECLADO, indicePorCategoria, useChartInteraction } from "./use-chart-interaction";
import { useChartTheme } from "./use-chart-theme";

registrarGraficas();

const LIMITE_POR_DEFECTO = 15;
/** Con más unidades las etiquetas no caben bajo columnas: se pasa a barras horizontales. */
const MAX_COLUMNAS = 6;
/** Unidades donde el competidor no gana: variante tenue de su color. */
const ALFA_OTRA_POSICION = 0.4;

type Metrica = NonNullable<DesempenoCompetidorChartProps["metrica"]>;
type UnidadDesempeno = DetalleCompetidorResponse["unidades"][number];

const valorMetrica = (unidad: UnidadDesempeno, metrica: Metrica) => (metrica === "pct" ? unidad.pct : unidad.votos);
const formatMetrica = (valor: number, metrica: Metrica) => (metrica === "pct" ? formatPct(valor) : `${formatNumero(valor)} votos`);
/** `null`: la unidad no registra votos por ningún competidor. */
const formatPosicion = (posicion: number | null) => (posicion === null ? "—" : `${posicion}.º`);

export function DesempenoCompetidorChart({
  competidor,
  color,
  unidades,
  metrica = "votos",
  limite = LIMITE_POR_DEFECTO,
  onSelectUnidad,
}: DesempenoCompetidorChartProps) {
  const tema = useChartTheme();

  const filas = useMemo(
    () => [...unidades].sort((a, b) => valorMetrica(b, metrica) - valorMetrica(a, metrica)).slice(0, limite),
    [unidades, metrica, limite],
  );
  const horizontal = filas.length > MAX_COLUMNAS;
  const ejeIndice = horizontal ? "y" : "x";
  const ejeValor = horizontal ? "x" : "y";
  const ganadas = filas.filter((f) => f.posicion === 1).length;

  const datos = useMemo<ChartData<"bar", number[], string>>(
    () => ({
      labels: filas.map((f) => f.unidad.nombre),
      datasets: [
        {
          label: metrica,
          data: filas.map((f) => valorMetrica(f, metrica)),
          backgroundColor: (ctx) =>
            colorSegunResaltado(ctx.chart, ctx.dataIndex, color, filas[ctx.dataIndex]?.posicion === 1 ? 1 : ALFA_OTRA_POSICION),
          maxBarThickness: 22,
          categoryPercentage: 0.8,
          barPercentage: 0.9,
        },
      ],
    }),
    [filas, metrica, color],
  );

  const opciones = useMemo<ChartOptions<"bar">>(
    () => ({
      indexAxis: ejeIndice,
      events: [],
      scales: {
        [ejeValor]: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: tema.grilla, drawTicks: false },
          ticks: {
            maxTicksLimit: 5,
            padding: 6,
            color: tema.textoSecundario,
            font: { size: 11 },
            callback: (valor: number | string) =>
              metrica === "pct" ? formatPctEje(Number(valor)) : formatCompacto(Number(valor)),
          },
        },
        [ejeIndice]: {
          border: { display: false },
          grid: { display: false },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            padding: 8,
            color: tema.texto,
            callback(_valor: number | string, indice: number) {
              return etiquetaEje(this, filas[indice]?.unidad.nombre ?? "");
            },
          },
        },
      },
      plugins: {
        tooltip: {
          ...coloresTooltip(tema),
          callbacks: {
            title: (items) => filas[items[0]?.dataIndex ?? -1]?.unidad.nombre ?? "",
            label: (item) => {
              const fila = filas[item.dataIndex];
              if (!fila) return "";
              return [`${formatPct(fila.pct)} de los votos válidos`, `${formatNumero(fila.votos)} votos`];
            },
            labelColor: (item) =>
              claveTooltip(filas[item.dataIndex]?.posicion === 1 ? color : withAlpha(color, ALFA_OTRA_POSICION)),
            footer: (items) => {
              const fila = filas[items[0]?.dataIndex ?? -1];
              return fila ? `Posición en la unidad: ${formatPosicion(fila.posicion)}` : "";
            },
          },
        },
      },
    }),
    [ejeIndice, ejeValor, filas, metrica, color, tema],
  );

  const { chartRef, propsMarco } = useChartInteraction<"bar", number[], string>({
    total: filas.length,
    datos,
    indiceEnEvento: indicePorCategoria(ejeIndice),
    describir: (indice) => {
      const fila = filas[indice];
      if (!fila) return "";
      const posicion = fila.posicion === null ? "sin posición" : `posición ${fila.posicion}`;
      return `${fila.unidad.nombre}: ${formatPct(fila.pct)} de los votos válidos, ${formatNumero(fila.votos)} votos, ${posicion}`;
    },
    onSeleccionar: onSelectUnidad
      ? (indice) => {
          const fila = filas[indice];
          if (fila) onSelectUnidad(fila.unidad.codigo);
        }
      : undefined,
  });

  if (filas.length === 0) return <ChartVacio descripcion="Este competidor no registra votos en las unidades del ámbito." />;

  const [mejor] = filas;
  const ganadasTotal = unidades.filter((u) => u.posicion === 1).length;
  const visibles = filas.length === 1 ? "la unidad" : `las ${formatNumero(filas.length)} unidades`;
  const etiqueta = [
    `Desempeño de ${competidor.nombre} en ${visibles} con mayor ${metrica === "pct" ? "porcentaje" : "votación"}.`,
    `Mejor resultado en ${mejor.unidad.nombre}: ${formatMetrica(valorMetrica(mejor, metrica), metrica)}.`,
    `Primer lugar en ${formatNumero(ganadasTotal)} de ${formatCantidad(unidades.length, "unidad", "unidades")}.`,
    onSelectUnidad ? AYUDA_SELECCION : AYUDA_TECLADO,
  ].join(" ");

  return (
    <div className="flex size-full min-h-0 flex-col gap-3">
      <Leyenda aria-label="Leyenda de posición en la unidad">
        <LeyendaItem color={color} etiqueta="Primer lugar" valor={formatNumero(ganadas)} />
        <LeyendaItem
          color={withAlpha(color, ALFA_OTRA_POSICION)}
          etiqueta="Otra posición"
          valor={formatNumero(filas.length - ganadas)}
        />
      </Leyenda>
      <ChartFrame etiqueta={etiqueta} className="flex-1" {...propsMarco}>
        <Bar key={ejeIndice} ref={chartRef} data={datos} options={opciones} aria-hidden />
      </ChartFrame>
    </div>
  );
}
