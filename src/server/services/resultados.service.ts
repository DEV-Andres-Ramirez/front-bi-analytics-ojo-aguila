import "server-only";
import { getNivel, nivelDeCodigo } from "@/domain/niveles";
import {
  calcularKpis,
  codigosRuta,
  competidoresPrincipales,
  construirCompetidores,
  construirDesempeno,
  construirHijos,
  construirVotoLista,
  estaAtadoAUnTerritorio,
  idsPrincipales,
  indicesDeColor,
  planHijos,
  territoriosDeCompetidores,
  totalesDeVotos,
  UNIDAD_COLOMBIA,
  type NombresEleccion,
  type PlanHijos,
  type UnidadResolver,
  type VotosClave,
} from "@/domain/resultados";
import type {
  DetalleCompetidorResponse,
  Dimension,
  EleccionRef,
  GeografiaResponse,
  ResultadosResponse,
  UnidadGeografica,
} from "@/domain/types";
import {
  esCorporacionDeLista,
  idCandidato,
  largoCircunscripcion,
  muestraLugarDeCompetidor,
  nivelContieneCircunscripciones,
  territorioDeCircunscripcion,
} from "@/domain/votos";
import { formatNombre } from "@/lib/format";
import { HttpError, type ConsultaCompetidor, type ConsultaResultados } from "@/server/http";
import { getEleccionId } from "@/server/repositories/catalogo.repository";
import { listarGeografia, listarZonasUnicas } from "@/server/repositories/geografia.repository";
import { listarCandidatos, listarPartidos } from "@/server/repositories/nombres.repository";
import {
  desempenoUnidadesHijas,
  resumenUnidadesHijas,
  votosDelAmbito,
} from "@/server/repositories/resultados.repository";

const TTL_MEMORIA_MS = 60 * 60 * 1000;

/**
 * Memoriza en el proceso, con TTL, datos pequeños y estables entre refrescos de las vistas.
 * Guarda la promesa (evita cargas duplicadas concurrentes) y la descarta si falla.
 */
function memorizar<A extends unknown[], V>(
  claveDe: (...args: A) => string,
  cargar: (...args: A) => Promise<V>,
): (...args: A) => Promise<V> {
  const entradas = new Map<string, { expira: number; valor: Promise<V> }>();

  return (...args) => {
    const clave = claveDe(...args);
    const vigente = entradas.get(clave);
    if (vigente && vigente.expira > Date.now()) return vigente.valor;

    const valor = cargar(...args);
    entradas.set(clave, { expira: Date.now() + TTL_MEMORIA_MS, valor });
    valor.catch(() => {
      if (entradas.get(clave)?.valor === valor) entradas.delete(clave);
    });
    return valor;
  };
}

interface IndiceGeografico {
  /** Por código, incluida Colombia (""). Nombres ya formateados. */
  unidades: ReadonlyMap<string, UnidadGeografica>;
  /** Departamentos y municipios por código: lugares de circunscripción de las claves de candidato. */
  lugares: ReadonlyMap<string, string>;
  /** Departamentos, municipios y puestos para el buscador, en orden de código. */
  items: GeografiaResponse["items"];
}

const indiceGeografico = memorizar(
  () => "geografia",
  async (): Promise<IndiceGeografico> => {
    const unidades = new Map<string, UnidadGeografica>([["", UNIDAD_COLOMBIA]]);
    const lugares = new Map<string, string>();
    const items: GeografiaResponse["items"] = [];

    for (const fila of await listarGeografia()) {
      const unidad: UnidadGeografica = {
        codigo: fila.codigo,
        nivel: nivelDeCodigo(fila.codigo).id,
        nombre: formatNombre(fila.nombre),
      };
      unidades.set(unidad.codigo, unidad);

      if (unidad.nivel === "zona") continue;
      if (unidad.nivel !== "puesto") lugares.set(unidad.codigo, unidad.nombre);
      items.push([unidad.codigo, unidad.nombre]);
    }
    return { unidades, lugares, items };
  },
);

/**
 * Elección con su id interno (permanente, de `ojo_aguila.registro_eleccion`). Las memorias por
 * elección se identifican también por sus filtros, por si el esquema se reconstruye desde cero.
 */
interface EleccionResuelta {
  id: number;
  ref: EleccionRef;
}

function claveEleccion({ id, ref }: EleccionResuelta): string {
  return [id, ref.tipificacion, ref.corporacion, ref.periodo].join("|");
}

const nombresEleccion = memorizar(claveEleccion, async ({ id }) => {
  const [candidatos, partidos] = await Promise.all([listarCandidatos(id), listarPartidos(id)]);
  return {
    candidatos: new Map(
      candidatos.map((fila) => [
        idCandidato(fila.codPartido, fila.codCandidato, fila.clave),
        { nombre: formatNombre(fila.nombreCandidato), partido: formatNombre(fila.nombrePartido) },
      ]),
    ),
    partidos: new Map(partidos.map((fila) => [fila.codPartido, formatNombre(fila.nombrePartido)])),
  };
});

const votosNacionales = memorizar(claveEleccion, ({ id, ref }) => votosDelAmbito(id, "", largoCircunscripcion(ref)));

/** Municipio → su única zona con votos en la elección (solo municipios con una zona). */
const zonasUnicasDe = memorizar(
  claveEleccion,
  async ({ id }): Promise<ReadonlyMap<string, string>> =>
    new Map((await listarZonasUnicas(id)).map(({ municipio, zona }) => [municipio, zona])),
);

const SIN_ZONAS_UNICAS: ReadonlyMap<string, string> = new Map();
const LONGITUD_MUNICIPIO = getNivel("municipio").longitud;

function votosDe(eleccion: EleccionResuelta, codigo: string): Promise<VotosClave[]> {
  return codigo === ""
    ? votosNacionales(eleccion)
    : votosDelAmbito(eleccion.id, codigo, largoCircunscripcion(eleccion.ref));
}

/** Ranking de la elección por dimensión en un ámbito de referencia ("" = nacional). */
const coloresDeReferencia = memorizar(
  (eleccion: EleccionResuelta, dimension: Dimension, referencia: string) =>
    `${claveEleccion(eleccion)}|${dimension}|${referencia}`,
  async (eleccion, dimension, referencia) => indicesDeColor(await votosDe(eleccion, referencia), dimension),
);

/**
 * Ámbito cuyo ranking fija los colores estables: el nacional, salvo candidatos dentro de su
 * circunscripción (Cámara, Asamblea y Gobernación dentro de un departamento; Alcaldía, Concejo y JAL
 * dentro de un municipio), que usan el ranking de ese departamento o municipio. Los partidos siempre
 * usan el nacional.
 */
function referenciaDeColores(eleccion: EleccionResuelta, dimension: Dimension, codigo: string): string {
  return dimension === "candidato" ? territorioDeCircunscripcion(eleccion.ref, codigo) : "";
}

function coloresEstables(eleccion: EleccionResuelta, dimension: Dimension, codigo: string) {
  return coloresDeReferencia(eleccion, dimension, referenciaDeColores(eleccion, dimension, codigo));
}

/**
 * Ranking de referencia del ámbito reutilizando sus propias filas cuando el ámbito **es** el
 * territorio de la circunscripción (Cámara en un departamento, Concejo en un municipio…): ahí la
 * referencia y el ámbito coinciden y lanzar `coloresEstables` en paralelo repetía la misma consulta.
 */
function coloresDelAmbito(
  eleccion: EleccionResuelta,
  dimension: Dimension,
  codigo: string,
  votos: Promise<VotosClave[]>,
): Promise<ReadonlyMap<string, number>> {
  const referencia = referenciaDeColores(eleccion, dimension, codigo);
  return referencia === codigo
    ? votos.then((filas) => indicesDeColor(filas, dimension))
    : coloresDeReferencia(eleccion, dimension, referencia);
}

interface Ambito {
  eleccion: EleccionResuelta;
  unidad: UnidadGeografica;
  plan: PlanHijos | null;
  geografia: IndiceGeografico;
  /** Zonas únicas de la elección; vacío en Colombia y departamentos, que no las necesitan. */
  zonasUnicas: ReadonlyMap<string, string>;
  unidadDe: UnidadResolver;
}

async function resolverAmbito({ eleccion, codigo }: ConsultaResultados): Promise<Ambito> {
  const [eleccionId, geografia] = await Promise.all([getEleccionId(eleccion), indiceGeografico()]);
  if (eleccionId === null) throw new HttpError(404, "La elección seleccionada no existe");

  const unidad = geografia.unidades.get(codigo);
  if (!unidad) throw new HttpError(404, "La unidad geográfica no existe");

  const eleccionResuelta: EleccionResuelta = { id: eleccionId, ref: eleccion };
  const zonasUnicas = codigo.length >= LONGITUD_MUNICIPIO ? await zonasUnicasDe(eleccionResuelta) : SIN_ZONAS_UNICAS;

  return {
    eleccion: eleccionResuelta,
    unidad,
    plan: planHijos(codigo, zonasUnicas.get(codigo)),
    geografia,
    zonasUnicas,
    unidadDe: (hijo) =>
      geografia.unidades.get(hijo) ?? { codigo: hijo, nivel: nivelDeCodigo(hijo).id, nombre: hijo },
  };
}

async function datosCompetidores(ambito: Ambito, dimension: Dimension) {
  const { eleccion, unidad, geografia } = ambito;
  const votosDelAmbitoActual = votosDe(eleccion, unidad.codigo);
  const [nombres, colores, votos] = await Promise.all([
    nombresEleccion(eleccion),
    coloresDelAmbito(eleccion, dimension, unidad.codigo, votosDelAmbitoActual),
    votosDelAmbitoActual,
  ]);
  // La geografía reúne todas las elecciones: un lugar puede existir sin votos en la elegida.
  if (unidad.codigo !== "" && votos.length === 0) {
    throw new HttpError(404, "Este lugar no registra votos en la elección seleccionada");
  }
  const nombresConLugares: NombresEleccion = { ...nombres, lugares: geografia.lugares };
  return { nombres: nombresConLugares, colores, votos };
}

/**
 * Cada candidato o lista compite solo en su circunscripción: cuando las unidades hijas contienen
 * circunscripciones completas (p. ej. departamentos para Cámara, o departamentos y municipios para
 * Alcaldía), una unidad sin votos es un lugar donde no estaba en el tarjetón, no una debilidad. Las
 * vistas de votos solo guardan votos > 0, así que votos 0 equivale a no competir.
 */
function soloDondeCompite(ambito: Ambito): boolean {
  return !!ambito.plan && nivelContieneCircunscripciones(ambito.eleccion.ref, ambito.plan.nivel);
}

export async function obtenerResultados(consulta: ConsultaResultados): Promise<ResultadosResponse> {
  const { eleccion, codigo, dimension } = consulta;
  const ambito = await resolverAmbito(consulta);
  const { nombres, colores, votos } = await datosCompetidores(ambito, dimension);

  const competidores = construirCompetidores(votos, dimension, nombres, colores, {
    mostrarLugar: muestraLugarDeCompetidor(eleccion, codigo),
  });
  const topIds = idsPrincipales(competidores);
  const [resumenes, coloresPartidos] = await Promise.all([
    ambito.plan ? resumenUnidadesHijas(ambito.eleccion.id, ambito.plan, dimension, topIds) : [],
    esCorporacionDeLista(eleccion) ? coloresEstables(ambito.eleccion, "partido", codigo) : null,
  ]);

  return {
    eleccion,
    dimension,
    ambito: {
      unidad: ambito.unidad,
      ruta: codigosRuta(codigo, ambito.zonasUnicas).map(ambito.unidadDe),
      nivelHijos: ambito.plan?.nivel ?? null,
    },
    kpis: calcularKpis(totalesDeVotos(votos)),
    competidores: competidoresPrincipales(competidores),
    totalCompetidores: competidores.length,
    votoLista: coloresPartidos ? construirVotoLista(votos, nombres, coloresPartidos) : null,
    hijos: construirHijos(resumenes, topIds, ambito.unidadDe),
    topIds,
  };
}

export async function obtenerDetalleCompetidor(consulta: ConsultaCompetidor): Promise<DetalleCompetidorResponse> {
  const { eleccion, dimension, competidorId } = consulta;
  const ambito = await resolverAmbito(consulta);
  const [{ nombres, colores, votos }, desempeno] = await Promise.all([
    datosCompetidores(ambito, dimension),
    ambito.plan ? desempenoUnidadesHijas(ambito.eleccion.id, ambito.plan, dimension, competidorId) : [],
  ]);

  const competidor = construirCompetidores(votos, dimension, nombres, colores, {
    mostrarLugar: muestraLugarDeCompetidor(eleccion, ambito.unidad.codigo),
  }).find(({ id }) => id === competidorId);
  if (!competidor) throw new HttpError(404, "El competidor no tiene votos en este ámbito");

  // Las circunscripciones especiales de Cámara (afro, indígena, CITREP) son nacionales pese a que la
  // corporación es departamental: solo se filtra a quien compite en un único territorio.
  const atadoAUnTerritorio = estaAtadoAUnTerritorio(territoriosDeCompetidores(votos, dimension), competidorId);
  const unidadesCompetidas =
    soloDondeCompite(ambito) && atadoAUnTerritorio ? desempeno.filter(({ votos }) => votos > 0) : desempeno;
  return {
    eleccion,
    dimension,
    ambito: { unidad: ambito.unidad, nivelHijos: ambito.plan?.nivel ?? null },
    competidor,
    unidades: construirDesempeno(unidadesCompetidas, ambito.unidadDe),
  };
}

/** Índice de departamentos, municipios y puestos para el buscador. */
export async function obtenerGeografia(): Promise<GeografiaResponse> {
  return { items: (await indiceGeografico()).items };
}
