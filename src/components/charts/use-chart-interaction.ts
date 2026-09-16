"use client";

import type { ActiveDataPoint, Chart, ChartType, DefaultDataPoint, Point } from "chart.js";
import { getRelativePosition } from "chart.js/helpers";
import {
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react";

export type BuscarIndice = (chart: Chart, evento: Event) => number | null;

interface OpcionesInteraccion {
  /** Cantidad de elementos navegables (filas de la gráfica o geometrías del mapa). */
  total: number;
  /** Datos memorizados de la gráfica: al cambiar se descarta el resaltado anterior. */
  datos: unknown;
  indiceEnEvento: BuscarIndice;
  /** Marcas a resaltar para un índice. Por defecto, todas las series visibles en ese índice. */
  elementos?: (chart: Chart, indice: number) => ActiveDataPoint[];
  /** Texto del dato en un índice (el mismo del tooltip) para anunciarlo al recorrer con el teclado. */
  describir: (indice: number) => string;
  esSeleccionable?: (indice: number) => boolean;
  onSeleccionar?: (indice: number) => void;
}

export const AYUDA_TECLADO = "Use las flechas para recorrer los datos.";
export const AYUDA_SELECCION = "Use las flechas para recorrer los datos y Enter para abrir el detalle.";

function elementosEnIndice(chart: Chart, indice: number): ActiveDataPoint[] {
  return chart.data.datasets
    .map((_, datasetIndex) => ({ datasetIndex, index: indice }))
    .filter(({ datasetIndex }) => chart.isDatasetVisible(datasetIndex));
}

function posicionTooltip(chart: Chart, activos: ActiveDataPoint[]): Point {
  const [primero] = activos;
  const elemento = primero && chart.getDatasetMeta(primero.datasetIndex).data[primero.index];
  return elemento ? elemento.tooltipPosition(true) : { x: 0, y: 0 };
}

function limpiarResaltado(chartRef: RefObject<unknown>, activoRef: RefObject<number | null>) {
  const chart = chartRef.current as Chart | null;
  activoRef.current = null;
  if (!chart) return;
  chart.setActiveElements([]);
  chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
}

/** Índice de la categoría bajo el puntero, incluida el área de etiquetas del eje. */
export function indicePorCategoria(eje: "x" | "y"): BuscarIndice {
  return (chart, evento) => {
    const { x, y } = getRelativePosition(evento, chart);
    const { left, right, top, bottom } = chart.chartArea;
    const escala = chart.scales[eje];
    const total = chart.data.labels?.length ?? 0;
    const dentro = eje === "y" ? y >= top && y <= bottom : x >= left && x <= right;
    if (!escala || total === 0 || !dentro) return null;
    const indice = Math.round(escala.getValueForPixel(eje === "y" ? y : x) ?? -1);
    return indice >= 0 && indice < total ? indice : null;
  };
}

/** Índice de la marca que contiene al puntero (geometrías del mapa, sectores). */
export const indicePorInterseccion: BuscarIndice = (chart, evento) =>
  chart.getElementsAtEventForMode(evento, "nearest", { intersect: true }, false)[0]?.index ?? null;

/**
 * Resaltado, tooltip y selección controlados desde React para puntero, toque y teclado.
 * La gráfica debe declarar `events: []` para que Chart.js no compita por el estado activo.
 * Con teclado, el dato resaltado se anuncia en la región viva de `ChartFrame` (`propsMarco.anuncio`).
 */
export function useChartInteraction<TType extends ChartType, TData = DefaultDataPoint<TType>, TLabel = unknown>({
  total,
  datos,
  indiceEnEvento,
  elementos = elementosEnIndice,
  describir,
  esSeleccionable = () => true,
  onSeleccionar,
}: OpcionesInteraccion) {
  const chartRef = useRef<Chart<TType, TData, TLabel> | null>(null);
  const activoRef = useRef<number | null>(null);
  const [anuncio, setAnuncio] = useState("");

  useLayoutEffect(() => () => limpiarResaltado(chartRef, activoRef), [datos]);

  const obtenerChart = () => chartRef.current as unknown as Chart | null;

  function resaltar(indice: number | null) {
    const chart = obtenerChart();
    if (!chart || activoRef.current === indice) return;
    activoRef.current = indice;
    const activos = indice === null ? [] : elementos(chart, indice);
    chart.setActiveElements(activos);
    chart.tooltip?.setActiveElements(activos, posicionTooltip(chart, activos));
    chart.update("none");
  }

  function resaltarConTeclado(indice: number | null) {
    resaltar(indice);
    setAnuncio(indice === null ? "" : `${describir(indice)} (${indice + 1} de ${total})`);
  }

  function indiceDesdeEvento(evento: MouseEvent | PointerEvent): number | null {
    const chart = obtenerChart();
    return chart ? indiceEnEvento(chart, evento.nativeEvent) : null;
  }

  const puedeSeleccionar = (indice: number | null): indice is number =>
    indice !== null && onSeleccionar !== undefined && esSeleccionable(indice);

  function onPointerMove(evento: PointerEvent<HTMLDivElement>) {
    const indice = indiceDesdeEvento(evento);
    evento.currentTarget.style.cursor = puedeSeleccionar(indice) ? "pointer" : "";
    resaltar(indice);
  }

  function onPointerLeave(evento: PointerEvent<HTMLDivElement>) {
    evento.currentTarget.style.cursor = "";
    resaltar(null);
  }

  function onClick(evento: MouseEvent<HTMLDivElement>) {
    const indice = indiceDesdeEvento(evento);
    if (puedeSeleccionar(indice)) onSeleccionar?.(indice);
    else resaltar(indice);
  }

  function onKeyDown(evento: KeyboardEvent<HTMLDivElement>) {
    if (total === 0) return;
    const actual = activoRef.current;
    const ultimo = total - 1;
    let siguiente: number | null;
    switch (evento.key) {
      case "ArrowDown":
      case "ArrowRight":
        siguiente = actual === null ? 0 : Math.min(actual + 1, ultimo);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        siguiente = actual === null ? ultimo : Math.max(actual - 1, 0);
        break;
      case "Home":
        siguiente = 0;
        break;
      case "End":
        siguiente = ultimo;
        break;
      case "Escape":
        siguiente = null;
        break;
      case "Enter":
      case " ":
        if (!puedeSeleccionar(actual)) return;
        evento.preventDefault();
        onSeleccionar?.(actual);
        return;
      default:
        return;
    }
    evento.preventDefault();
    resaltarConTeclado(siguiente);
  }

  function onFocus(evento: FocusEvent<HTMLDivElement>) {
    if (evento.currentTarget.matches(":focus-visible") && activoRef.current === null) resaltarConTeclado(0);
  }

  return {
    chartRef,
    propsMarco: {
      tabIndex: total > 0 ? 0 : -1,
      onPointerMove,
      onPointerLeave,
      onClick,
      onKeyDown,
      onFocus,
      onBlur: () => resaltarConTeclado(null),
      anuncio,
    },
  };
}
