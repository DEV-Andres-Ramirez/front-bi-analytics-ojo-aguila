import type { ArcElement, BarElement, Chart, ChartType, Plugin } from "chart.js";
import { toFont } from "chart.js/helpers";
import type { GeoFeature } from "chartjs-chart-geo";
import { formatPct } from "@/lib/format";

interface OpcionesEtiquetaFinal {
  color: string;
}

interface OpcionesTextoCentral {
  valor: string;
  etiqueta: string;
  color: string;
  colorEtiqueta: string;
}

interface OpcionesResaltadoGeo {
  /** Trazo de la geometría resaltada (puntero o teclado). */
  colorResaltado: string;
  colorRecuadro: string;
  colorEtiqueta: string;
  /** Índice de la geometría reubicada en recuadro (San Andrés) o -1. */
  indiceRecuadro: number;
  etiquetaRecuadro: string;
}

declare module "chart.js" {
  // La firma genérica debe coincidir con la declaración original de Chart.js.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    etiquetaFinalBarra?: OpcionesEtiquetaFinal;
    textoCentral?: OpcionesTextoCentral;
    resaltadoGeo?: OpcionesResaltadoGeo;
  }
}

function fuente(chart: Chart, size: number, weight: number): string {
  return toFont({ ...chart.options.font, size, weight }).string;
}

/** Porcentaje al final de cada barra horizontal; acompaña la animación de crecimiento. */
export const etiquetaFinalBarra: Plugin<"bar", OpcionesEtiquetaFinal> = {
  id: "etiquetaFinalBarra",
  afterDatasetsDraw(chart, _args, opciones) {
    const valores = chart.data.datasets[0]?.data ?? [];
    const { ctx } = chart;
    ctx.save();
    ctx.font = fuente(chart as unknown as Chart, 12, 600);
    ctx.fillStyle = opciones.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    chart.getDatasetMeta(0).data.forEach((elemento, indice) => {
      const valor = valores[indice];
      const { x, y } = (elemento as BarElement).getProps(["x", "y"]);
      if (typeof valor !== "number" || x === null || y === null) return;
      ctx.fillText(formatPct(valor), x + 6, y);
    });
    ctx.restore();
  },
};

/** Cifra principal y su etiqueta en el hueco de la dona, ajustadas al radio interior. */
export const textoCentral: Plugin<"doughnut", OpcionesTextoCentral> = {
  id: "textoCentral",
  afterDatasetsDraw(chart, _args, { valor, etiqueta, color, colorEtiqueta }) {
    const arco = chart.getDatasetMeta(0).data[0] as ArcElement | undefined;
    if (!arco || !valor) return;
    const { x, y, innerRadius } = arco.getProps(["x", "y", "innerRadius"], true);
    if (x === null || y === null) return;
    const { ctx } = chart;
    const base = chart as unknown as Chart;
    const anchoMaximo = innerRadius * 1.5;

    let tamanoValor = Math.min(Math.max(innerRadius * 0.34, 14), 32);
    ctx.save();
    ctx.font = fuente(base, tamanoValor, 600);
    const ancho = ctx.measureText(valor).width;
    if (ancho > anchoMaximo) {
      tamanoValor *= anchoMaximo / ancho;
      ctx.font = fuente(base, tamanoValor, 600);
    }
    const tamanoEtiqueta = Math.min(Math.max(innerRadius * 0.14, 11), 14);
    const separacion = tamanoValor * 0.12;
    const arriba = y - (tamanoValor + separacion + tamanoEtiqueta) / 2;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(valor, x, arriba + tamanoValor / 2);
    ctx.font = fuente(base, tamanoEtiqueta, 500);
    ctx.fillStyle = colorEtiqueta;
    ctx.fillText(etiqueta, x, arriba + tamanoValor + separacion + tamanoEtiqueta / 2);
    ctx.restore();
  },
};

export const MARGEN_RECUADRO_PX = 8;

/** Contorno de la geometría activa (siempre por encima de sus vecinas) y marco del recuadro insular. */
export const resaltadoGeo: Plugin<"choropleth", OpcionesResaltadoGeo> = {
  id: "resaltadoGeo",
  afterDatasetsDraw(chart, _args, opciones) {
    const { ctx } = chart;
    const recuadro = chart.getDatasetMeta(0).data[opciones.indiceRecuadro] as GeoFeature | undefined;

    ctx.save();
    if (recuadro) {
      const limites = recuadro.getBounds();
      if (Number.isFinite(limites.x)) {
        const x = limites.x - MARGEN_RECUADRO_PX;
        const y = limites.y - MARGEN_RECUADRO_PX;
        const ancho = limites.width + MARGEN_RECUADRO_PX * 2;
        const alto = limites.height + MARGEN_RECUADRO_PX * 2;
        ctx.beginPath();
        ctx.roundRect(x, y, ancho, alto, 6);
        ctx.lineWidth = 1;
        ctx.strokeStyle = opciones.colorRecuadro;
        ctx.stroke();
        ctx.font = fuente(chart as unknown as Chart, 10, 500);
        ctx.fillStyle = opciones.colorEtiqueta;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const mitadEtiqueta = ctx.measureText(opciones.etiquetaRecuadro).width / 2 + 2;
        const centro = Math.min(Math.max(x + ancho / 2, mitadEtiqueta), chart.width - mitadEtiqueta);
        ctx.fillText(opciones.etiquetaRecuadro, centro, y + alto + 4);
      }
    }

    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.strokeStyle = opciones.colorResaltado;
    chart.getActiveElements().forEach(({ element }) => {
      const geometria = element as unknown as GeoFeature;
      ctx.beginPath();
      geometria.projectionScale.geoPath.context(ctx)(geometria.feature);
      ctx.stroke();
    });
    ctx.restore();
  },
};
