import "server-only";
import { query } from "@/server/db/pool";

export interface GeografiaFila {
  /** Prefijo divipole: su longitud determina el nivel. */
  codigo: string;
  /** Nombre en mayúsculas tal como viene de la fuente. */
  nombre: string;
}

export interface ZonaUnicaFila {
  municipio: string;
  zona: string;
}

/** Todas las unidades geográficas con votos (departamento a puesto), en orden de código. */
export function listarGeografia(): Promise<GeografiaFila[]> {
  return query<GeografiaFila>(`SELECT codigo, nombre FROM ojo_aguila.geografia ORDER BY codigo`);
}

/** Municipios con votos en una sola zona en la elección, con el código de esa zona. */
export function listarZonasUnicas(eleccionId: number): Promise<ZonaUnicaFila[]> {
  return query<ZonaUnicaFila>(
    `SELECT padre AS municipio, min(ambito) AS zona
       FROM ojo_aguila.votos_zona
      WHERE eleccion_id = $1
      GROUP BY padre
     HAVING min(ambito) = max(ambito)`,
    [eleccionId],
  );
}
