import { getNivel } from "@/domain/niveles";
import type { Dimension, EleccionRef, NivelId } from "@/domain/types";
import { formatEtiquetaCatalogo } from "@/lib/format";

export const ETIQUETA_DIMENSION: Record<Dimension, { titulo: string; singular: string; plural: string }> = {
  candidato: { titulo: "Candidato", singular: "candidato", plural: "candidatos" },
  partido: { titulo: "Partido", singular: "partido", plural: "partidos" },
};

/** "Presidencia · Primera Vuelta · 2022" */
export function etiquetaEleccion(eleccion: EleccionRef): string {
  return [formatEtiquetaCatalogo(eleccion.tipificacion), formatEtiquetaCatalogo(eleccion.corporacion), eleccion.periodo].join(" · ");
}

/** Etiquetas en minúscula de un nivel para usar dentro de frases ("Gana en 3 de 5 municipios"). */
export function etiquetasNivel(nivel: NivelId): { singular: string; plural: string } {
  const { etiqueta, etiquetaPlural } = getNivel(nivel);
  return { singular: etiqueta.toLowerCase(), plural: etiquetaPlural.toLowerCase() };
}
