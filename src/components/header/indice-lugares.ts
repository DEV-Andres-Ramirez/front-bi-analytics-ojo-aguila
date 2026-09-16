import { getNivel, rutaDeCodigo } from "@/domain/niveles";
import type { GeografiaResponse } from "@/domain/types";
import { normalizarBusqueda } from "@/lib/format";

/** Niveles buscables, en el orden en que se agrupan los resultados. */
const NIVELES_BUSQUEDA = ["departamento", "municipio", "puesto"] as const;
export type NivelBusqueda = (typeof NIVELES_BUSQUEDA)[number];

export const LIMITE_RESULTADOS = 50;

export interface Lugar {
  codigo: string;
  nombre: string;
  nivel: NivelBusqueda;
  /** Ruta de ancestros legible: "Antioquia › Medellín" ("Colombia" para departamentos). */
  contexto: string;
  /** Nombre normalizado para buscar (sin tildes ni mayúsculas). */
  clave: string;
  /** Nombre y contexto normalizados: "cabecera tunja" encuentra el puesto genérico por su municipio. */
  claveContexto: string;
}

const NIVEL_POR_LONGITUD = new Map(NIVELES_BUSQUEDA.map((nivel) => [getNivel(nivel).longitud, nivel]));
const SEPARADOR_RUTA = " › ";
/** Prefijo de código: empieza por el departamento; algunos puestos tienen letras ("0100199A1"). */
const PATRON_CODIGO = /^\d{2}[0-9a-z]*$/;

/** Construye el índice una sola vez: nivel, contexto de ruta y nombre normalizado. */
export function indexarLugares(items: GeografiaResponse["items"]): Lugar[] {
  const nombres = new Map(items);
  const lugares: Lugar[] = [];

  for (const [codigo, nombre] of items) {
    const nivel = NIVEL_POR_LONGITUD.get(codigo.length);
    if (!nivel) continue;

    const ancestros = rutaDeCodigo(codigo)
      .slice(1, -1)
      .map((ancestro) => nombres.get(ancestro))
      .filter((nombreAncestro): nombreAncestro is string => Boolean(nombreAncestro));

    const contexto = ancestros.length > 0 ? ancestros.join(SEPARADOR_RUTA) : "Colombia";
    lugares.push({
      codigo,
      nombre,
      nivel,
      contexto,
      clave: normalizarBusqueda(nombre),
      claveContexto: normalizarBusqueda(`${nombre} ${contexto}`),
    });
  }
  return lugares;
}

/**
 * 0 = coincidencia exacta, 1 = prefijo, 2 = el nombre contiene todos los términos,
 * 3 = nombre y contexto los contienen (solo con varios términos); null si no coincide.
 */
type Relevancia = 0 | 1 | 2 | 3;
const NIVELES_RELEVANCIA = 4;

function relevanciaPorCodigo(codigo: string, prefijo: string): Relevancia | null {
  if (!codigo.startsWith(prefijo)) return null;
  return codigo === prefijo ? 0 : 1;
}

function relevanciaPorNombre(lugar: Lugar, texto: string, terminos: string[]): Relevancia | null {
  const { clave, claveContexto } = lugar;
  if (clave === texto) return 0;
  if (clave.startsWith(texto)) return 1;
  if (terminos.every((termino) => clave.includes(termino))) return 2;
  // Con un solo término el contexto no cuenta: "antioquia" no debe listar todos sus puestos.
  return terminos.length > 1 && terminos.every((termino) => claveContexto.includes(termino)) ? 3 : null;
}

/**
 * Busca por nombre (todos los términos, sin importar tildes; con varios, también en el municipio y
 * el departamento) o por prefijo de código. Ordena por relevancia y luego por nivel, sin ordenar el índice.
 */
export function buscarLugares(lugares: readonly Lugar[], consulta: string, limite = LIMITE_RESULTADOS): Lugar[] {
  const texto = normalizarBusqueda(consulta);
  if (!texto) return [];

  const terminos = texto.split(" ");
  // Los códigos llegan en mayúsculas y la consulta normalizada, en minúsculas.
  const prefijoCodigo = PATRON_CODIGO.test(texto) ? texto.toUpperCase() : null;
  const cubetas: Lugar[][] = Array.from({ length: NIVELES_RELEVANCIA * NIVELES_BUSQUEDA.length }, () => []);

  for (const lugar of lugares) {
    const relevancia =
      (prefijoCodigo ? relevanciaPorCodigo(lugar.codigo, prefijoCodigo) : null) ??
      relevanciaPorNombre(lugar, texto, terminos);
    if (relevancia === null) continue;
    cubetas[relevancia * NIVELES_BUSQUEDA.length + NIVELES_BUSQUEDA.indexOf(lugar.nivel)].push(lugar);
  }

  return cubetas.flat().slice(0, limite);
}

/** Sugerencias sin texto de búsqueda: todos los departamentos. */
export function sugerenciasIniciales(lugares: readonly Lugar[]): Lugar[] {
  return lugares.filter((lugar) => lugar.nivel === "departamento");
}

export function agruparPorNivel(lugares: readonly Lugar[]): { nivel: NivelBusqueda; lugares: Lugar[] }[] {
  return NIVELES_BUSQUEDA.map((nivel) => ({ nivel, lugares: lugares.filter((lugar) => lugar.nivel === nivel) })).filter(
    (grupo) => grupo.lugares.length > 0,
  );
}
