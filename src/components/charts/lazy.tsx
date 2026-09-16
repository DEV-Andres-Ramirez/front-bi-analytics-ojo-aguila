"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Punto de entrada de las gráficas para el resto de la app.
 * Chart.js depende de `window`: se cargan solo en cliente y bajo demanda.
 * (next/dynamic exige que las opciones sean un objeto literal en cada llamada.)
 */
function ChartLoading() {
  return <Skeleton className="size-full min-h-56 rounded-xl" />;
}

export const RankingChart = dynamic(() => import("./ranking-chart").then((m) => m.RankingChart), {
  ssr: false,
  loading: ChartLoading,
});

export const ComposicionChart = dynamic(() => import("./composicion-chart").then((m) => m.ComposicionChart), {
  ssr: false,
  loading: ChartLoading,
});

export const DistribucionChart = dynamic(() => import("./distribucion-chart").then((m) => m.DistribucionChart), {
  ssr: false,
  loading: ChartLoading,
});

export const MapaColombia = dynamic(() => import("./mapa-colombia").then((m) => m.MapaColombia), {
  ssr: false,
  loading: ChartLoading,
});

export const VotoListaChart = dynamic(() => import("./voto-lista-chart").then((m) => m.VotoListaChart), {
  ssr: false,
  loading: ChartLoading,
});

/**
 * Descarga por adelantado el código de las gráficas y la geometría del mapa, para que lleguen junto
 * con los datos en lugar de encadenar esqueletos. Los fallos se ignoran: cada gráfica reintenta al montarse.
 */
export function precargarGraficas(): void {
  const ignorar = () => {};
  void import("./ranking-chart").catch(ignorar);
  void import("./composicion-chart").catch(ignorar);
  void import("./distribucion-chart").catch(ignorar);
  void import("./mapa-colombia").catch(ignorar);
  void import("./voto-lista-chart").catch(ignorar);
  void import("./desempeno-competidor-chart").catch(ignorar);
  void import("./use-departamentos-geo").then((modulo) => modulo.cargarDepartamentos()).catch(ignorar);
}

export const DesempenoCompetidorChart = dynamic(
  () => import("./desempeno-competidor-chart").then((m) => m.DesempenoCompetidorChart),
  { ssr: false, loading: ChartLoading },
);
