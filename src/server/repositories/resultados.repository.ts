import "server-only";
import { codigoPadre, nivelDeCodigo } from "@/domain/niveles";
import type { DesempenoUnidad, PlanHijos, ResumenUnidad, VotosClave } from "@/domain/resultados";
import type { Dimension, NivelId } from "@/domain/types";
import { CODIGO_CANDIDATO } from "@/domain/votos";
import { query } from "@/server/db/pool";

/** Vista de votos por nivel. Única fuente de nombres de tabla: nunca se interpola entrada del usuario. */
const VISTA_VOTOS: Partial<Record<NivelId, string>> = {
  departamento: "ojo_aguila.votos_departamento",
  municipio: "ojo_aguila.votos_municipio",
  zona: "ojo_aguila.votos_zona",
  puesto: "ojo_aguila.votos_puesto",
};

/** Id del competidor en SQL; debe coincidir con `idCompetidor` del dominio. */
const ID_COMPETIDOR_SQL: Record<Dimension, string> = {
  candidato: "cod_partido || '-' || cod_candidato || '-' || clave",
  partido: "cod_partido",
};

/** Competidores por unidad hija que siempre se incluyen en el resumen (ganador y segundo). */
const COMPETIDORES_POR_UNIDAD = 2;

function vistaVotos(nivel: NivelId): string {
  const vista = VISTA_VOTOS[nivel];
  if (!vista) throw new Error(`El nivel "${nivel}" no tiene vista de votos`);
  return vista;
}

const COLUMNAS_CLAVE = `cod_partido AS "codPartido", cod_candidato AS "codCandidato", clave`;

/**
 * Votos del ámbito por partido–candidato–clave. Colombia ("") suma los departamentos.
 *
 * `largoCircunscripcion` (0 nacional, 2 departamento, 5 municipio) agrega el territorio **real** de
 * cada combinación: en Colombia, `count(distinct)` sobre el prefijo distingue a quien compite en un
 * solo departamento o municipio de quien abarca varios (las circunscripciones especiales de Cámara
 * —afro, indígena y CITREP— son nacionales aunque la regla las trate como departamentales). En
 * cualquier otro ámbito hay un único territorio: el prefijo del propio ámbito.
 */
export function votosDelAmbito(eleccionId: number, codigo: string, largoCircunscripcion: number): Promise<VotosClave[]> {
  if (codigo === "") {
    return query<VotosClave>(
      `SELECT ${COLUMNAS_CLAVE},
              sum(votos)::integer AS votos,
              count(DISTINCT left(ambito, $2::integer))::integer AS territorios,
              min(left(ambito, $2::integer)) AS territorio
         FROM ojo_aguila.votos_departamento
        WHERE eleccion_id = $1 AND padre = ''
        GROUP BY cod_partido, cod_candidato, clave`,
      [eleccionId, largoCircunscripcion],
    );
  }
  return query<VotosClave>(
    `SELECT ${COLUMNAS_CLAVE}, votos, 1 AS territorios, left($3::text, $4::integer) AS territorio
       FROM ${vistaVotos(nivelDeCodigo(codigo).id)}
      WHERE eleccion_id = $1 AND padre = $2 AND ambito = $3`,
    [eleccionId, codigoPadre(codigo), codigo, largoCircunscripcion],
  );
}

/**
 * CTEs compartidas sobre las unidades hijas ($1 elección, $2 padre, $3..$5 votos especiales):
 * `unidad` con totales por unidad y `competidor` con los votos de cada competidor por unidad.
 */
function ctesUnidadesHijas(plan: PlanHijos, dimension: Dimension): string {
  return `
    base AS (
      SELECT ambito, cod_candidato, ${ID_COMPETIDOR_SQL[dimension]} AS id, votos
        FROM ${vistaVotos(plan.nivel)}
       WHERE eleccion_id = $1 AND padre = $2
    ),
    unidad AS (
      SELECT ambito,
             sum(votos)::integer AS total,
             coalesce(sum(votos) FILTER (WHERE cod_candidato = $3), 0)::integer AS blanco,
             coalesce(sum(votos) FILTER (WHERE cod_candidato = $4), 0)::integer AS nulos,
             coalesce(sum(votos) FILTER (WHERE cod_candidato = $5), 0)::integer AS no_marcados
        FROM base
       GROUP BY ambito
    ),
    competidor AS (
      SELECT ambito, id, sum(votos)::integer AS votos
        FROM base
       WHERE cod_candidato NOT IN ($3, $4, $5)
       GROUP BY ambito, id
    )`;
}

function parametrosUnidadesHijas(eleccionId: number, plan: PlanHijos): unknown[] {
  return [eleccionId, plan.padre, CODIGO_CANDIDATO.BLANCO, CODIGO_CANDIDATO.NULO, CODIGO_CANDIDATO.NO_MARCADO];
}

interface TotalesFila {
  codigo: string;
  total: number;
  blanco: number;
  nulos: number;
  noMarcados: number;
}

const COLUMNAS_TOTALES = `u.ambito AS codigo, u.total, u.blanco, u.nulos, u.no_marcados AS "noMarcados"`;

function totalesDeFila({ total, blanco, nulos, noMarcados }: TotalesFila) {
  return { total, blanco, nulos, noMarcados };
}

/**
 * Totales de cada unidad hija con sus dos competidores principales y los votos de `topIds`.
 * Se agrega en SQL para no transferir la matriz completa unidad × competidor. Los dos principales
 * se eligen con `row_number` (con los mismos votos, por id) para acotar las filas; el dominio
 * detecta el empate comparando sus votos.
 */
export async function resumenUnidadesHijas(
  eleccionId: number,
  plan: PlanHijos,
  dimension: Dimension,
  topIds: readonly string[],
): Promise<ResumenUnidad[]> {
  const filas = await query<TotalesFila & { id: string | null; votos: number | null }>(
    `WITH ${ctesUnidadesHijas(plan, dimension)},
     ordenados AS (
       SELECT ambito, id, votos, row_number() OVER (PARTITION BY ambito ORDER BY votos DESC, id) AS orden
         FROM competidor
     )
     SELECT ${COLUMNAS_TOTALES}, r.id, r.votos
       FROM unidad AS u
       LEFT JOIN ordenados AS r
         ON r.ambito = u.ambito AND (r.orden <= $6 OR r.id = ANY($7::text[]))`,
    [...parametrosUnidadesHijas(eleccionId, plan), COMPETIDORES_POR_UNIDAD, topIds],
  );

  const resumenes = new Map<string, ResumenUnidad>();
  for (const fila of filas) {
    let resumen = resumenes.get(fila.codigo);
    if (!resumen) {
      resumen = { codigo: fila.codigo, totales: totalesDeFila(fila), competidores: [] };
      resumenes.set(fila.codigo, resumen);
    }
    if (fila.id !== null && fila.votos !== null) resumen.competidores.push({ id: fila.id, votos: fila.votos });
  }
  return [...resumenes.values()];
}

/**
 * Votos y posición de un competidor en cada unidad hija. Los empatados comparten posición (`rank`).
 * Donde no tiene votos, su posición es la siguiente al último competidor con votos; null si la
 * unidad no tiene votos por ningún competidor (solo blanco, nulos o no marcados).
 */
export async function desempenoUnidadesHijas(
  eleccionId: number,
  plan: PlanHijos,
  dimension: Dimension,
  competidorId: string,
): Promise<DesempenoUnidad[]> {
  const filas = await query<TotalesFila & { votos: number; posicion: number | null }>(
    `WITH ${ctesUnidadesHijas(plan, dimension)},
     ranking AS (
       SELECT ambito, id, votos, rank() OVER (PARTITION BY ambito ORDER BY votos DESC)::integer AS posicion
         FROM competidor
     ),
     participantes AS (
       SELECT ambito, count(*)::integer AS cantidad FROM competidor GROUP BY ambito
     )
     SELECT ${COLUMNAS_TOTALES},
            coalesce(r.votos, 0) AS votos,
            coalesce(r.posicion, p.cantidad + 1) AS posicion
       FROM unidad AS u
       LEFT JOIN ranking AS r ON r.ambito = u.ambito AND r.id = $6
       LEFT JOIN participantes AS p ON p.ambito = u.ambito`,
    [...parametrosUnidadesHijas(eleccionId, plan), competidorId],
  );

  return filas.map((fila) => ({
    codigo: fila.codigo,
    totales: totalesDeFila(fila),
    votos: fila.votos,
    posicion: fila.posicion,
  }));
}
