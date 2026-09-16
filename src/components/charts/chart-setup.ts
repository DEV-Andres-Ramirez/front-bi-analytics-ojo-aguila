import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { ChoroplethController, ColorScale, GeoFeature, ProjectionScale } from "chartjs-chart-geo";
import { formatNumero } from "@/lib/format";

const DURACION_ANIMACION_MS = 700;
const DURACION_HOVER_MS = 180;
const FUENTE_RESPALDO = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

let registrado = false;

/** Geist llega como variable CSS de next/font; el canvas necesita el nombre real de la familia. */
function resolverFuente(): string {
  const geist = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-sans").trim();
  return geist ? `${geist}, ${FUENTE_RESPALDO}` : FUENTE_RESPALDO;
}

function aplicarMovimiento(reducido: boolean) {
  Chart.defaults.set("animation", {
    duration: reducido ? 0 : DURACION_ANIMACION_MS,
    easing: "easeOutQuart",
  });
  Chart.defaults.set("transitions.active.animation", { duration: reducido ? 0 : DURACION_HOVER_MS });
  Chart.defaults.set("plugins.tooltip.animation", { duration: reducido ? 0 : DURACION_HOVER_MS });
}

function redibujarGraficas() {
  Object.values(Chart.instances as Record<string, Chart>).forEach((chart) => chart.update("none"));
}

function aplicarDefaults() {
  Chart.defaults.locale = "es-CO";
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.font.family = resolverFuente();
  Chart.defaults.font.size = 12;

  Chart.defaults.set("elements.bar", { borderRadius: 4, borderSkipped: "start" });
  Chart.defaults.set("scales.linear.ticks", { callback: (valor: number | string) => formatNumero(Number(valor)) });
  Chart.defaults.set("plugins.legend", { display: false });
  Chart.defaults.set("plugins.tooltip", {
    cornerRadius: 10,
    padding: { x: 12, y: 10 },
    caretSize: 6,
    caretPadding: 8,
    titleFont: { size: 12, weight: 500 },
    titleMarginBottom: 6,
    bodyFont: { size: 13, weight: 600 },
    bodySpacing: 4,
    footerFont: { size: 11, weight: 400 },
    footerMarginTop: 6,
    boxWidth: 12,
    boxHeight: 3,
    boxPadding: 6,
    borderWidth: 0,
  });

  const movimiento = window.matchMedia(REDUCED_MOTION_QUERY);
  aplicarMovimiento(movimiento.matches);
  movimiento.addEventListener("change", (evento) => aplicarMovimiento(evento.matches));

  // Si Geist termina de cargar después del primer render, el canvas se repinta con la fuente final.
  document.fonts.ready.then(() => {
    Chart.defaults.font.family = resolverFuente();
    redibujarGraficas();
  });
}

/** Registra controladores, escalas y defaults de Chart.js una sola vez por sesión del navegador. */
export function registrarGraficas(): void {
  if (registrado || typeof window === "undefined") return;
  registrado = true;
  Chart.register(
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    DoughnutController,
    ArcElement,
    Tooltip,
    Legend,
    ChoroplethController,
    GeoFeature,
    ColorScale,
    ProjectionScale,
  );
  aplicarDefaults();
}
