import { codigoPadre, nivelDeCodigo, nivelHijo, rutaDeCodigo } from "./niveles";
import type {
  Competidor,
  CompetidorEnUnidad,
  DetalleCompetidorResponse,
  Dimension,
  Kpis,
  NivelId,
  UnidadGeografica,
  UnidadResultado,
  VotoListaPartido,
} from "./types";
import { esVotoPorCompetidor, idCandidato, PATRON_ID_CANDIDATO, tipoVoto } from "./votos";

/** Votos de una combinación partido–candidato–clave dentro de un ámbito. */
export interface VotosClave {
  codPartido: string;
  codCandidato: string;
  clave: string;
  votos: number;
  /**
   * Territorios de la circunscripción (prefijos divipole) con votos de esta combinación dentro del
   * ámbito. Lo calcula la consulta: 1 en un ámbito único; en el nacional distingue a quien compite en
   * un solo departamento o municipio de quien abarca varios (circunscripciones especiales de Cámara).
   */
  territorios: number;
  /** Menor de esos territorios; es el único cuando `territorios === 1`. `""` si la corporación es nacional. */
  territorio: string;
}

/** Votos de una unidad: total y votos especiales. El resto son votos por competidores. */
export interface TotalesVoto {
  total: number;
  blanco: number;
  nulos: number;
  noMarcados: number;
}

/** Votos de un competidor; el id depende de la dimensión. */
export interface VotosCompetidor {
  id: string;
  votos: number;
}

export interface NombreCandidato {
  nombre: string;
  partido: string;
}

/** Nombres ya formateados que requiere la descripción de competidores. */
export interface NombresEleccion {
  /** Por `idCandidato`. */
  candidatos: ReadonlyMap<string, NombreCandidato>;
  /** Por código de partido. */
  partidos: ReadonlyMap<string, string>;
  /** Por código de departamento o municipio: lugar de la circunscripción de las claves distintas de "00". */
  lugares: ReadonlyMap<string, string>;
}

/** Resumen de una unidad hija: sus totales y, al menos, sus dos competidores principales. */
export interface ResumenUnidad {
  codigo: string;
  totales: TotalesVoto;
  competidores: VotosCompetidor[];
}

/** Votos y posición de un competidor dentro de una unidad hija. */
export interface DesempenoUnidad {
  codigo: string;
  totales: TotalesVoto;
  votos: number;
  /** Empatados comparten posición; null si la unidad no tiene votos por ningún competidor. */
  posicion: number | null;
}

export type UnidadResolver = (codigo: string) => UnidadGeografica;

export const UNIDAD_COLOMBIA: UnidadGeografica = { codigo: "", nivel: "nacional", nombre: "Colombia" };

/** Competidores principales del ámbito que se desglosan en cada unidad hija. */
export const LIMITE_TOP_IDS = 5;

/**
 * Tope defensivo de competidores por respuesta. Una función de Vercel corta el cuerpo en 4,5 MB y la
 * UI no puede listar decenas de miles de filas, así que la respuesta lleva los `LIMITE_COMPETIDORES`
 * con más votos y `ResultadosResponse.totalCompetidores` dice cuántos hay en total. Con 1.000 el peor
 * caso ronda los 220 KB; la regla de producto (`admiteDimensionCandidato`) evita antes los ámbitos
 * donde la lista no tendría sentido, así que el tope casi nunca se aplica (JAL en un municipio
 * grande, o los partidos de Alcaldía a nivel nacional).
 */
export const LIMITE_COMPETIDORES = 1_000;

/** Índice de color para competidores fuera del ranking de referencia (fuera de la paleta). */
export const COLOR_SIN_RANKING = 999;

const DETALLE_CANDIDATO_LISTA = "Voto solo por la lista";
const DETALLE_PARTIDO_LISTA = "Voto por lista";

const PATRON_ID_COMPETIDOR: Record<Dimension, RegExp> = {
  candidato: PATRON_ID_CANDIDATO,
  partido: /^\d{5}$/,
};

export function esIdCompetidorValido(id: string, dimension: Dimension): boolean {
  return PATRON_ID_COMPETIDOR[dimension].test(id);
}

/** Las proporciones viajan con 5 decimales (0,001 %): suficiente para la UI y reduce el payload. */
const ESCALA_PROPORCION = 1e5;

function redondearProporcion(valor: number): number {
  return Math.round(valor * ESCALA_PROPORCION) / ESCALA_PROPORCION;
}

/** Proporción 0..1 redondeada a 5 decimales; 0 cuando el divisor es 0. */
export function proporcion(parte: number, total: number): number {
  return total > 0 ? redondearProporcion(parte / total) : 0;
}

function compararCodigos(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Orden de listado: más votos primero; con los mismos votos, id ascendente (igual que
 * `ORDER BY votos DESC, id` en SQL). No decide empates: ver `UnidadResultado.empate`.
 */
export function compararCompetidores(a: VotosCompetidor, b: VotosCompetidor): number {
  return b.votos - a.votos || compararCodigos(a.id, b.id);
}

export function totalesDeVotos(votos: readonly VotosClave[]): TotalesVoto {
  const totales: TotalesVoto = { total: 0, blanco: 0, nulos: 0, noMarcados: 0 };
  for (const fila of votos) {
    totales.total += fila.votos;
    switch (tipoVoto(fila.codCandidato)) {
      case "BLANCO":
        totales.blanco += fila.votos;
        break;
      case "NULO":
        totales.nulos += fila.votos;
        break;
      case "NO_MARCADO":
        totales.noMarcados += fila.votos;
        break;
    }
  }
  return totales;
}

export function calcularKpis({ total, blanco, nulos, noMarcados }: TotalesVoto): Kpis {
  const votosCandidatos = total - blanco - nulos - noMarcados;
  const votosValidos = votosCandidatos + blanco;
  return {
    totalVotos: total,
    votosValidos,
    votosCandidatos,
    votosBlanco: blanco,
    votosNulos: nulos,
    votosNoMarcados: noMarcados,
    pctBlanco: proporcion(blanco, votosValidos),
    pctNulos: proporcion(nulos, total),
    pctNoMarcados: proporcion(noMarcados, total),
  };
}

export function idCompetidor(fila: VotosClave, dimension: Dimension): string {
  return dimension === "candidato" ? idCandidato(fila.codPartido, fila.codCandidato, fila.clave) : fila.codPartido;
}

interface GrupoCompetidor extends VotosCompetidor {
  filas: VotosClave[];
}

/** Agrupa los votos por competidor (sin blanco, nulos ni no marcados) en orden de ranking. */
function agruparCompetidores(votos: readonly VotosClave[], dimension: Dimension): GrupoCompetidor[] {
  const grupos = new Map<string, GrupoCompetidor>();
  for (const fila of votos) {
    if (!esVotoPorCompetidor(tipoVoto(fila.codCandidato))) continue;
    const id = idCompetidor(fila, dimension);
    const grupo = grupos.get(id);
    if (grupo) {
      grupo.votos += fila.votos;
      grupo.filas.push(fila);
    } else {
      grupos.set(id, { id, votos: fila.votos, filas: [fila] });
    }
  }
  return [...grupos.values()].sort(compararCompetidores);
}

/** Posición (0-based) de cada competidor en el ranking: alimenta `Competidor.colorIndex`. */
export function indicesDeColor(votos: readonly VotosClave[], dimension: Dimension): Map<string, number> {
  return new Map(agruparCompetidores(votos, dimension).map((grupo, indice) => [grupo.id, indice]));
}

/**
 * Territorio de la circunscripción de cada competidor del ámbito: su código cuando compite en uno
 * solo y `null` cuando abarca varios. Es el territorio **real** (de los votos), no el que insinúa la
 * `clave`: las circunscripciones especiales de Cámara (afro, indígena y CITREP) son nacionales, y las
 * listas y los partidos aparecen en todos los territorios donde se presentaron.
 */
export function territoriosDeCompetidores(
  votos: readonly VotosClave[],
  dimension: Dimension,
): Map<string, string | null> {
  const territorios = new Map<string, string | null>();
  for (const fila of votos) {
    if (!esVotoPorCompetidor(tipoVoto(fila.codCandidato))) continue;
    const id = idCompetidor(fila, dimension);
    const territorio = fila.territorios === 1 ? fila.territorio : null;
    // Un competidor con filas en territorios distintos (dimensión partido) también abarca varios.
    if (territorios.has(id)) {
      if (territorios.get(id) !== territorio) territorios.set(id, null);
    } else {
      territorios.set(id, territorio);
    }
  }
  return territorios;
}

/** Compite en un solo territorio de su circunscripción (y por tanto no estaba en el tarjetón fuera de él). */
export function estaAtadoAUnTerritorio(territorios: ReadonlyMap<string, string | null>, id: string): boolean {
  return typeof territorios.get(id) === "string";
}

function indiceDeColor(colores: ReadonlyMap<string, number>, id: string): number {
  return colores.get(id) ?? COLOR_SIN_RANKING;
}

function nombrePartido(nombres: NombresEleccion, codPartido: string): string {
  return nombres.partidos.get(codPartido) ?? `Partido ${codPartido}`;
}

/** Nombre de un territorio de circunscripción (departamento o municipio); null si no hay territorio. */
function nombreDeLugar(territorio: string | null, nombres: NombresEleccion): string | null {
  if (!territorio) return null;
  return nombres.lugares.get(territorio) ?? `${nivelDeCodigo(territorio).etiqueta} ${territorio}`;
}

function describirCandidato(
  fila: VotosClave,
  nombres: NombresEleccion,
  lugar: string | null,
): Pick<Competidor, "nombre" | "detalle" | "tipo"> {
  const tipo = tipoVoto(fila.codCandidato);
  const candidato = nombres.candidatos.get(idCandidato(fila.codPartido, fila.codCandidato, fila.clave));
  const partido = candidato?.partido ?? nombrePartido(nombres, fila.codPartido);
  const detalle = tipo === "LISTA" ? DETALLE_CANDIDATO_LISTA : partido;

  return {
    nombre: candidato?.nombre ?? (tipo === "LISTA" ? partido : `Candidato ${fila.codCandidato}`),
    detalle: lugar ? `${detalle} · ${lugar}` : detalle,
    tipo,
  };
}

function describirPartido(grupo: GrupoCompetidor, nombres: NombresEleccion): Pick<Competidor, "nombre" | "detalle" | "tipo"> {
  const candidatos = new Set(
    grupo.filas
      .filter((fila) => fila.votos > 0 && tipoVoto(fila.codCandidato) === "CANDIDATO")
      .map((fila) => idCandidato(fila.codPartido, fila.codCandidato, fila.clave)),
  ).size;

  return {
    nombre: nombrePartido(nombres, grupo.id),
    detalle:
      candidatos === 0 ? DETALLE_PARTIDO_LISTA : `${candidatos} ${candidatos === 1 ? "candidato" : "candidatos"}`,
    tipo: "CANDIDATO",
  };
}

export interface OpcionesCompetidores {
  /**
   * Añadir a cada candidato el lugar donde compite (ver `muestraLugarDeCompetidor`). Se usa el
   * territorio real de sus votos, así que o lo llevan todos los candidatos atados a un territorio o
   * no lo lleva ninguno.
   */
  mostrarLugar?: boolean;
}

/**
 * Competidores del ámbito en orden de ranking, con % sobre válidos y el color de `colores` (ranking
 * de referencia: nacional o de la circunscripción, ver `indicesDeColor`). Devuelve la lista completa:
 * el tope de la respuesta se aplica después (`LIMITE_COMPETIDORES`).
 */
export function construirCompetidores(
  votos: readonly VotosClave[],
  dimension: Dimension,
  nombres: NombresEleccion,
  colores: ReadonlyMap<string, number>,
  { mostrarLugar = false }: OpcionesCompetidores = {},
): Competidor[] {
  const { votosValidos } = calcularKpis(totalesDeVotos(votos));
  const territorios = mostrarLugar ? territoriosDeCompetidores(votos, dimension) : null;

  return agruparCompetidores(votos, dimension).map((grupo) => ({
    id: grupo.id,
    ...(dimension === "candidato"
      ? describirCandidato(grupo.filas[0], nombres, nombreDeLugar(territorios?.get(grupo.id) ?? null, nombres))
      : describirPartido(grupo, nombres)),
    votos: grupo.votos,
    pctValidos: proporcion(grupo.votos, votosValidos),
    colorIndex: indiceDeColor(colores, grupo.id),
  }));
}

export function idsPrincipales(competidores: readonly Competidor[]): string[] {
  return competidores.slice(0, LIMITE_TOP_IDS).map((competidor) => competidor.id);
}

/**
 * Competidores que viajan en la respuesta: los `LIMITE_COMPETIDORES` con más votos (ya vienen en ese
 * orden). Devuelve la misma lista si no hay que recortar.
 */
export function competidoresPrincipales(competidores: Competidor[]): Competidor[] {
  return competidores.length > LIMITE_COMPETIDORES ? competidores.slice(0, LIMITE_COMPETIDORES) : competidores;
}

/** Voto por lista (candidato 00000) frente a voto preferente, por partido y en orden de votos. */
export function construirVotoLista(
  votos: readonly VotosClave[],
  nombres: NombresEleccion,
  coloresPartidos: ReadonlyMap<string, number>,
): VotoListaPartido[] {
  const partidos = new Map<string, VotoListaPartido>();
  for (const fila of votos) {
    const tipo = tipoVoto(fila.codCandidato);
    if (!esVotoPorCompetidor(tipo)) continue;

    let partido = partidos.get(fila.codPartido);
    if (!partido) {
      partido = {
        codPartido: fila.codPartido,
        nombre: nombrePartido(nombres, fila.codPartido),
        votosLista: 0,
        votosPreferente: 0,
        colorIndex: indiceDeColor(coloresPartidos, fila.codPartido),
      };
      partidos.set(fila.codPartido, partido);
    }
    if (tipo === "LISTA") partido.votosLista += fila.votos;
    else partido.votosPreferente += fila.votos;
  }

  const total = (partido: VotoListaPartido) => partido.votosLista + partido.votosPreferente;
  return [...partidos.values()].sort((a, b) => total(b) - total(a) || compararCodigos(a.codPartido, b.codPartido));
}

function resultadoDeUnidad(resumen: ResumenUnidad, unidad: UnidadGeografica, topIds: readonly string[]): UnidadResultado {
  const { totalVotos, votosValidos, votosBlanco, pctBlanco } = calcularKpis(resumen.totales);
  const [primero, segundo] = [...resumen.competidores].sort(compararCompetidores);
  const enUnidad = (competidor: VotosCompetidor | undefined): CompetidorEnUnidad | null =>
    competidor
      ? { id: competidor.id, votos: competidor.votos, pct: proporcion(competidor.votos, votosValidos) }
      : null;

  const ganador = enUnidad(primero);
  const siguiente = enUnidad(segundo);
  const votosPorId = new Map(resumen.competidores.map((competidor) => [competidor.id, competidor.votos]));

  return {
    unidad,
    totalVotos,
    votosValidos,
    votosBlanco,
    pctBlanco,
    ganador,
    segundo: siguiente,
    margenPct: ganador && siguiente ? redondearProporcion(ganador.pct - siguiente.pct) : null,
    empate: !!ganador && !!siguiente && ganador.votos === siguiente.votos,
    top: Object.fromEntries(topIds.map((id) => [id, votosPorId.get(id) ?? 0])),
  };
}

/** Filas de la tabla territorial en orden descendente de votos totales. */
export function construirHijos(
  resumenes: readonly ResumenUnidad[],
  topIds: readonly string[],
  unidadDe: UnidadResolver,
): UnidadResultado[] {
  return resumenes
    .map((resumen) => resultadoDeUnidad(resumen, unidadDe(resumen.codigo), topIds))
    .sort((a, b) => b.totalVotos - a.totalVotos || compararCodigos(a.unidad.codigo, b.unidad.codigo));
}

/** Desempeño de un competidor por unidad hija, en orden descendente de votos. */
export function construirDesempeno(
  filas: readonly DesempenoUnidad[],
  unidadDe: UnidadResolver,
): DetalleCompetidorResponse["unidades"] {
  return filas
    .map((fila) => {
      const { votosValidos } = calcularKpis(fila.totales);
      return {
        unidad: unidadDe(fila.codigo),
        votos: fila.votos,
        votosValidos,
        pct: proporcion(fila.votos, votosValidos),
        posicion: fila.posicion,
      };
    })
    .sort((a, b) => b.votos - a.votos || compararCodigos(a.unidad.codigo, b.unidad.codigo));
}

/** Unidades hijas a consultar: nivel y código del padre común. */
export interface PlanHijos {
  nivel: NivelId;
  padre: string;
}

/**
 * Hijos de un ámbito o null si es hoja. Un municipio con una sola zona en la elección salta directo
 * a los puestos de esa zona (`zonaUnica`), porque el nivel zona no aporta información.
 */
export function planHijos(codigo: string, zonaUnica?: string): PlanHijos | null {
  const nivel = nivelDeCodigo(codigo);
  const hijo = nivelHijo(nivel.id);
  if (!hijo) return null;
  if (nivel.id === "municipio" && zonaUnica) return { nivel: "puesto", padre: zonaUnica };
  return { nivel: hijo.id, padre: codigo };
}

/**
 * Códigos de la ruta desde Colombia hasta `codigo`. Omite las zonas intermedias que son la única
 * zona de su municipio en la elección (`zonasUnicas`: municipio → zona), coherente con `planHijos`.
 */
export function codigosRuta(codigo: string, zonasUnicas: ReadonlyMap<string, string>): string[] {
  return rutaDeCodigo(codigo).filter((tramo) => {
    if (tramo === codigo || nivelDeCodigo(tramo).id !== "zona") return true;
    return zonasUnicas.get(codigoPadre(tramo) ?? "") !== tramo;
  });
}
