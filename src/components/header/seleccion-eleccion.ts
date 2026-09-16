import type { Catalogo, EleccionRef } from "@/domain/types";
import { formatEtiquetaCatalogo } from "@/lib/format";

export const TOTAL_PASOS = 3;

export type ValoresEleccion = { [K in keyof EleccionRef]: string | null };

/** Selección válida según el catálogo, con las opciones disponibles para cada paso. */
export interface SeleccionEleccion extends ValoresEleccion {
  /** Corporaciones de la tipificación elegida. */
  corporaciones: string[];
  /** Años de la tipificación y corporación elegidas. */
  periodos: string[];
}

/** Descarta los valores que no existen en el catálogo (p. ej. una URL editada a mano). */
export function resolverSeleccion(catalogo: Catalogo, valores: ValoresEleccion): SeleccionEleccion {
  const tipificacion = catalogo.find((t) => t.tipificacion === valores.tipificacion);
  const corporacion = tipificacion?.corporaciones.find((c) => c.corporacion === valores.corporacion);
  const periodo = corporacion?.periodos.find((p) => p === valores.periodo);

  return {
    tipificacion: tipificacion?.tipificacion ?? null,
    corporacion: corporacion?.corporacion ?? null,
    periodo: periodo ?? null,
    corporaciones: tipificacion?.corporaciones.map((c) => c.corporacion) ?? [],
    periodos: corporacion?.periodos ?? [],
  };
}

function valoresElegidos({ tipificacion, corporacion, periodo }: SeleccionEleccion): string[] {
  return [tipificacion, corporacion, periodo].filter((valor): valor is string => valor !== null);
}

export function pasosCompletados(seleccion: SeleccionEleccion): number {
  return valoresElegidos(seleccion).length;
}

/** "Presidencia · Primera Vuelta · 2022" o null si no hay nada seleccionado. */
export function resumenSeleccion(seleccion: SeleccionEleccion): string | null {
  const partes = valoresElegidos(seleccion).map((valor) => formatEtiquetaCatalogo(valor));
  return partes.length > 0 ? partes.join(" · ") : null;
}
