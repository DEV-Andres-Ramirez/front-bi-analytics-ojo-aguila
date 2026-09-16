/**
 * Contratos compartidos entre servidor (API) y cliente (UI).
 * Tipos puros: sin dependencias de Node ni de React.
 */

/** Niveles de la jerarquía geográfica. `mesa` está reservado (ver `niveles.ts`). */
export type NivelId = "nacional" | "departamento" | "municipio" | "zona" | "puesto" | "mesa";

/** Dimensión por la que se agregan los resultados. */
export type Dimension = "candidato" | "partido";

/** Clasificación de cada registro de votos. */
export type TipoVoto = "CANDIDATO" | "LISTA" | "BLANCO" | "NULO" | "NO_MARCADO";

/** Identifica una elección con los tres filtros del header. */
export interface EleccionRef {
  tipificacion: string;
  corporacion: string;
  periodo: string;
}

/** Catálogo en cascada: Tipificación → Corporación → Periodos (años). */
export interface CatalogoTipificacion {
  tipificacion: string;
  corporaciones: { corporacion: string; periodos: string[] }[];
}
export type Catalogo = CatalogoTipificacion[];

/** Unidad geográfica. `codigo` es el prefijo divipole ("" = Colombia). */
export interface UnidadGeografica {
  codigo: string;
  nivel: NivelId;
  nombre: string;
}

export interface Kpis {
  /** Todos los votos depositados (incluye nulos y no marcados). */
  totalVotos: number;
  /** Votos válidos = votos por candidatos/listas + votos en blanco. */
  votosValidos: number;
  /** Votos por candidatos y listas (sin blanco). */
  votosCandidatos: number;
  votosBlanco: number;
  votosNulos: number;
  votosNoMarcados: number;
  /** Proporciones 0..1 — blanco sobre válidos; nulos y no marcados sobre total. */
  pctBlanco: number;
  pctNulos: number;
  pctNoMarcados: number;
}

/**
 * Candidato o partido con votos en el ámbito.
 * - dimensión `candidato`: id = `${codPartido}-${codCandidato}-${clave}`, con `clave` = `00`,
 *   departamento (`05`), municipio (`05001`) o, en JAL, municipio y nombre (`05001:3fa2c9`).
 *   Ver `PATRON_ID_CANDIDATO` en `votos.ts`.
 * - dimensión `partido`:   id = codPartido
 */
export interface Competidor {
  id: string;
  nombre: string;
  /**
   * Texto secundario: partido del candidato o "Voto solo por la lista". Cuando el ámbito es más
   * amplio que la circunscripción (ver `muestraLugarDeCompetidor` en `votos.ts`) se añade
   * " · <departamento o municipio donde compite>" a **todos** los candidatos atados a un territorio.
   */
  detalle: string;
  tipo: TipoVoto;
  votos: number;
  /** Proporción 0..1 sobre votos válidos del ámbito. */
  pctValidos: number;
  /**
   * Índice de color estable (ver `lib/palette.ts`): posición en el ranking nacional de la elección o,
   * para candidatos dentro de su circunscripción, en el de su departamento o municipio.
   */
  colorIndex: number;
}

/** Resumen de un competidor dentro de una unidad hija. */
export interface CompetidorEnUnidad {
  id: string;
  votos: number;
  /** Proporción 0..1 sobre votos válidos de la unidad. */
  pct: number;
}

/** Resultado agregado de una unidad hija del ámbito actual (fila de la tabla territorial). */
export interface UnidadResultado {
  unidad: UnidadGeografica;
  totalVotos: number;
  votosValidos: number;
  votosBlanco: number;
  /** Proporción 0..1 de blanco sobre válidos. */
  pctBlanco: number;
  ganador: CompetidorEnUnidad | null;
  segundo: CompetidorEnUnidad | null;
  /** Diferencia ganador − segundo en proporción 0..1. */
  margenPct: number | null;
  /** Ganador y segundo con los mismos votos: la UI no debe declarar ganador. */
  empate: boolean;
  /** Votos por competidor para los ids de `ResultadosResponse.topIds`. */
  top: Record<string, number>;
}

/** Voto por lista vs voto preferente por partido (solo corporaciones de lista). */
export interface VotoListaPartido {
  codPartido: string;
  nombre: string;
  votosLista: number;
  votosPreferente: number;
  colorIndex: number;
}

/** GET /api/resultados?t&c&a&g&d */
export interface ResultadosResponse {
  eleccion: EleccionRef;
  dimension: Dimension;
  ambito: {
    unidad: UnidadGeografica;
    /** Ruta desde Colombia hasta la unidad actual (incluida). */
    ruta: UnidadGeografica[];
    /** Nivel de las unidades hijas o null si es hoja. */
    nivelHijos: NivelId | null;
  };
  kpis: Kpis;
  /**
   * Competidores de la dimensión, orden descendente por votos (sin blanco/nulos/no marcados).
   * Recortada a los `LIMITE_COMPETIDORES` principales (ver `resultados.ts`): compárala con
   * `totalCompetidores` para saber si la respuesta llegó recortada.
   */
  competidores: Competidor[];
  /**
   * Competidores con votos en el ámbito, antes del tope. Mayor que `competidores.length` solo cuando
   * la lista se recortó; los votos de los que faltan están en `kpis.votosCandidatos`.
   */
  totalCompetidores: number;
  /** Solo corporaciones de lista (Senado, Cámara, Asamblea, Concejo, JAL); null en las uninominales. */
  votoLista: VotoListaPartido[] | null;
  /** Unidades hijas, orden descendente por total de votos. Vacío en hojas. */
  hijos: UnidadResultado[];
  /** Ids de los 5 principales competidores del ámbito (para gráficas apiladas). */
  topIds: string[];
}

/** GET /api/resultados/competidor?t&c&a&g&d&k */
export interface DetalleCompetidorResponse {
  eleccion: EleccionRef;
  dimension: Dimension;
  ambito: { unidad: UnidadGeografica; nivelHijos: NivelId | null };
  competidor: Competidor;
  /**
   * Desempeño del competidor en cada unidad hija, orden descendente por votos. Si las unidades hijas
   * contienen circunscripciones completas (p. ej. departamentos en Cámara o Alcaldía) **y** el
   * competidor está atado a un territorio, solo incluye aquellas donde tiene votos: las demás son
   * lugares donde no estaba en el tarjetón. Los competidores que abarcan varios territorios (las
   * circunscripciones especiales de Cámara —afro, indígena, CITREP— y las listas de partidos
   * presentes en varias circunscripciones) conservan todas las unidades, también las que tienen 0.
   */
  unidades: {
    unidad: UnidadGeografica;
    votos: number;
    votosValidos: number;
    /** Proporción 0..1 sobre válidos de la unidad. */
    pct: number;
    /**
     * Posición del competidor en la unidad (1 = primero; empatados comparten posición).
     * null si la unidad no tiene votos por ningún competidor.
     */
    posicion: number | null;
  }[];
}

/** GET /api/geografia — tuplas [codigo, nombre] de departamentos, municipios y puestos. */
export interface GeografiaResponse {
  items: [codigo: string, nombre: string][];
}
