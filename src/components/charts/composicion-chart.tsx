"use client";

import { useMemo, useRef } from "react";
import type { Chart, ChartData, ChartOptions } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import type { Competidor, Kpis } from "@/domain/types";
import type { ColoresCompetidores } from "@/hooks/use-colores-competidores";
import { formatCompacto, formatNumero, formatPct } from "@/lib/format";
import { ChartFrame, ChartVacio, Leyenda, LeyendaItem } from "./chart-frame";
import { textoCentral } from "./chart-plugins";
import type { ComposicionChartProps } from "./chart-props";
import { registrarGraficas } from "./chart-setup";
import { claveTooltip, coloresTooltip, enumerar, esVistaPartidos } from "./chart-utils";
import { useChartTheme, type ChartTheme } from "./use-chart-theme";

registrarGraficas();

const COMPETIDORES_VISIBLES = 5;
const PLUGINS = [textoCentral];

interface Segmento {
  clave: string;
  etiqueta: string;
  votos: number;
  pct: number;
  color: string;
}

function construirSegmentos(
  kpis: Kpis,
  competidores: Competidor[],
  colores: ColoresCompetidores,
  tema: ChartTheme,
): Segmento[] {
  const total = kpis.totalVotos;
  const principales = competidores.slice(0, COMPETIDORES_VISIBLES);
  const votosOtros = competidores.slice(COMPETIDORES_VISIBLES).reduce((suma, c) => suma + c.votos, 0);
  const otros = esVistaPartidos(competidores) ? "Otros partidos" : "Otros candidatos";

  const segmentos = [
    ...principales.map((c) => ({ clave: c.id, etiqueta: c.nombre, votos: c.votos, color: colores.competidor(c.id) })),
    { clave: "otros", etiqueta: otros, votos: votosOtros, color: tema.otros },
    { clave: "blanco", etiqueta: "Votos en blanco", votos: kpis.votosBlanco, color: tema.especial("BLANCO") },
    { clave: "nulos", etiqueta: "Votos nulos", votos: kpis.votosNulos, color: tema.especial("NULO") },
    { clave: "no-marcados", etiqueta: "No marcados", votos: kpis.votosNoMarcados, color: tema.especial("NO_MARCADO") },
  ];

  return segmentos
    .filter((s) => s.votos > 0)
    .map((s) => ({ ...s, pct: total > 0 ? s.votos / total : 0 }));
}

function resumir(total: number, segmentos: Segmento[]): string {
  const partes = segmentos.map((s) => `${s.etiqueta}, ${formatPct(s.pct)}`);
  return `Composición de ${formatNumero(total)} votos depositados: ${enumerar(partes)}.`;
}

export function ComposicionChart({ kpis, competidores, colores }: ComposicionChartProps) {
  const tema = useChartTheme();
  const chartRef = useRef<Chart<"doughnut", number[], string> | null>(null);
  const segmentos = useMemo(
    () => construirSegmentos(kpis, competidores, colores, tema),
    [kpis, competidores, colores, tema],
  );

  const datos = useMemo<ChartData<"doughnut", number[], string>>(
    () => ({
      labels: segmentos.map((s) => s.etiqueta),
      datasets: [
        {
          label: "Composición del voto",
          data: segmentos.map((s) => s.votos),
          backgroundColor: segmentos.map((s) => s.color),
          hoverBackgroundColor: segmentos.map((s) => s.color),
          borderColor: tema.superficie,
          hoverBorderColor: tema.superficie,
          borderWidth: 2,
          borderRadius: 4,
          hoverOffset: 6,
        },
      ],
    }),
    [segmentos, tema],
  );

  const opciones = useMemo<ChartOptions<"doughnut">>(
    () => ({
      cutout: "68%",
      layout: { padding: 8 },
      plugins: {
        textoCentral: {
          valor: formatCompacto(kpis.totalVotos),
          etiqueta: "votos",
          color: tema.texto,
          colorEtiqueta: tema.textoSecundario,
        },
        tooltip: {
          ...coloresTooltip(tema),
          callbacks: {
            title: ([item]) => segmentos[item.dataIndex]?.etiqueta ?? "",
            label: (item) => {
              const segmento = segmentos[item.dataIndex];
              return segmento ? `${formatPct(segmento.pct)} del total · ${formatNumero(segmento.votos)} votos` : "";
            },
            labelColor: (item) => claveTooltip(segmentos[item.dataIndex]?.color ?? tema.otros),
          },
        },
      },
    }),
    [kpis.totalVotos, segmentos, tema],
  );

  function resaltarSegmento(indice: number | null) {
    const chart = chartRef.current;
    if (!chart) return;
    const activos = indice === null ? [] : [{ datasetIndex: 0, index: indice }];
    chart.setActiveElements(activos);
    const elemento = indice === null ? undefined : chart.getDatasetMeta(0).data[indice];
    chart.tooltip?.setActiveElements(activos, elemento ? elemento.tooltipPosition(true) : { x: 0, y: 0 });
    chart.update();
  }

  if (segmentos.length === 0 || kpis.totalVotos === 0) return <ChartVacio />;

  return (
    <div className="@container flex size-full min-h-0 flex-col gap-4">
      <ChartFrame etiqueta={resumir(kpis.totalVotos, segmentos)} className="flex-1">
        <Doughnut ref={chartRef} data={datos} options={opciones} plugins={PLUGINS} aria-hidden />
      </ChartFrame>
      <Leyenda
        aria-label="Leyenda de la composición del voto (porcentaje sobre el total de votos)"
        className="grid grid-cols-1 gap-x-6 gap-y-1.5 @sm:grid-cols-2"
        onPointerLeave={() => resaltarSegmento(null)}
      >
        {segmentos.map((s, indice) => (
          <LeyendaItem
            key={s.clave}
            color={s.color}
            etiqueta={s.etiqueta}
            valor={formatPct(s.pct)}
            title={`${s.etiqueta}: ${formatNumero(s.votos)} votos`}
            className="rounded-sm"
            onPointerEnter={() => resaltarSegmento(indice)}
          />
        ))}
      </Leyenda>
    </div>
  );
}
