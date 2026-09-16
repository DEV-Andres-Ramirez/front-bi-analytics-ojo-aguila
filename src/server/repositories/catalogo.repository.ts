import "server-only";
import type { Catalogo, EleccionRef } from "@/domain/types";
import { query } from "@/server/db/pool";

const TTL_MS = 10 * 60 * 1000;

interface EleccionRow {
  id: number;
  tipificacion: string;
  corporacion: string;
  periodo: string;
}

let memo: { expira: number; elecciones: Promise<EleccionRow[]> } | null = null;

/** Elecciones disponibles (tabla de 12 filas), memorizadas en el proceso con TTL. */
function getElecciones(): Promise<EleccionRow[]> {
  if (!memo || memo.expira < Date.now()) {
    const elecciones = query<EleccionRow>(
      `SELECT id, tipificacion, corporacion, periodo
         FROM ojo_aguila.eleccion
        ORDER BY tipificacion, corporacion, periodo DESC`,
    );
    memo = { expira: Date.now() + TTL_MS, elecciones };
    elecciones.catch(() => {
      memo = null;
    });
  }
  return memo.elecciones;
}

/** Catálogo en cascada Tipificación → Corporación → Periodos (más reciente primero). */
export async function getCatalogo(): Promise<Catalogo> {
  const catalogo: Catalogo = [];
  for (const { tipificacion, corporacion, periodo } of await getElecciones()) {
    let tip = catalogo.find((t) => t.tipificacion === tipificacion);
    if (!tip) {
      tip = { tipificacion, corporaciones: [] };
      catalogo.push(tip);
    }
    let corp = tip.corporaciones.find((c) => c.corporacion === corporacion);
    if (!corp) {
      corp = { corporacion, periodos: [] };
      tip.corporaciones.push(corp);
    }
    corp.periodos.push(periodo);
  }
  return catalogo;
}

/** Id interno de la elección o null si la combinación no existe. */
export async function getEleccionId(eleccion: EleccionRef): Promise<number | null> {
  const found = (await getElecciones()).find(
    (e) =>
      e.tipificacion === eleccion.tipificacion &&
      e.corporacion === eleccion.corporacion &&
      e.periodo === eleccion.periodo,
  );
  return found?.id ?? null;
}
