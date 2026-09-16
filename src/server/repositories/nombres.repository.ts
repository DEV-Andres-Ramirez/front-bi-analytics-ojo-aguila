import "server-only";
import { query } from "@/server/db/pool";

export interface CandidatoFila {
  codPartido: string;
  codCandidato: string;
  clave: string;
  nombreCandidato: string;
  nombrePartido: string;
}

export interface PartidoFila {
  codPartido: string;
  nombrePartido: string;
}

/** Candidatos de la elección con sus nombres en mayúsculas de la fuente. */
export function listarCandidatos(eleccionId: number): Promise<CandidatoFila[]> {
  return query<CandidatoFila>(
    `SELECT cod_partido AS "codPartido",
            cod_candidato AS "codCandidato",
            clave,
            nombre_candidato AS "nombreCandidato",
            nombre_partido AS "nombrePartido"
       FROM ojo_aguila.candidato
      WHERE eleccion_id = $1`,
    [eleccionId],
  );
}

/** Partidos de la elección con sus nombres en mayúsculas de la fuente. */
export function listarPartidos(eleccionId: number): Promise<PartidoFila[]> {
  return query<PartidoFila>(
    `SELECT cod_partido AS "codPartido", nombre_partido AS "nombrePartido"
       FROM ojo_aguila.partido
      WHERE eleccion_id = $1`,
    [eleccionId],
  );
}
