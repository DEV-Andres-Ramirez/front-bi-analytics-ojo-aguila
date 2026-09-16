import { getNivel } from "./niveles";
import type { Dimension, EleccionRef, NivelId, TipoVoto } from "./types";

/** Códigos de candidato con significado especial en la fuente. */
export const CODIGO_CANDIDATO = {
  LISTA: "00000",
  BLANCO: "00996",
  NULO: "00997",
  NO_MARCADO: "00998",
} as const;

export function tipoVoto(codCandidato: string): TipoVoto {
  switch (codCandidato) {
    case CODIGO_CANDIDATO.BLANCO:
      return "BLANCO";
    case CODIGO_CANDIDATO.NULO:
      return "NULO";
    case CODIGO_CANDIDATO.NO_MARCADO:
      return "NO_MARCADO";
    case CODIGO_CANDIDATO.LISTA:
      return "LISTA";
    default:
      return "CANDIDATO";
  }
}

/** Voto por una opción política (candidato o lista). */
export function esVotoPorCompetidor(tipo: TipoVoto): boolean {
  return tipo === "CANDIDATO" || tipo === "LISTA";
}

/** Votos válidos = candidatos + listas + blanco. */
export function esVotoValido(tipo: TipoVoto): boolean {
  return esVotoPorCompetidor(tipo) || tipo === "BLANCO";
}

/** Territorio en el que compiten los candidatos de una corporación. Coincide con un nivel geográfico. */
export type Circunscripcion = Extract<NivelId, "nacional" | "departamento" | "municipio">;

interface ReglaCorporacion {
  circunscripcion: Circunscripcion;
  /** Se vota por lista (código 00000) o por candidato preferente; false = uninominal. */
  deLista: boolean;
  /**
   * La circunscripción real está **por debajo** de `circunscripcion` y la fuente no la trae, así que
   * se infiere de la unidad que sí llega. Solo JAL: se elige por comuna o localidad, y la fuente solo
   * da el municipio. Consecuencia: dentro del municipio tampoco se puede saber dónde estaba un
   * candidato en el tarjetón, así que una zona o un puesto sin votos no es una debilidad suya.
   */
  circunscripcionInferida?: boolean;
}

/**
 * Regla por corporación (`nombre_corporacion` de la fuente). Es la única definición en TypeScript y
 * se refleja en SQL en `ojo_aguila.circunscripcion()` (database/migrations/001_ojo_aguila.sql),
 * que decide la columna `clave`: si se agrega o cambia una corporación, hay que actualizar ambas y
 * reconstruir las vistas.
 */
const REGLAS_CORPORACION: ReadonlyMap<string, ReglaCorporacion> = new Map([
  ["PRIMERA VUELTA", { circunscripcion: "nacional", deLista: false }],
  ["SEGUNDA VUELTA", { circunscripcion: "nacional", deLista: false }],
  ["SENADO", { circunscripcion: "nacional", deLista: true }],
  ["CAMARA", { circunscripcion: "departamento", deLista: true }],
  ["ASAMBLEA", { circunscripcion: "departamento", deLista: true }],
  ["GOBERNADOR", { circunscripcion: "departamento", deLista: false }],
  ["ALCALDE", { circunscripcion: "municipio", deLista: false }],
  ["CONCEJO", { circunscripcion: "municipio", deLista: true }],
  ["JAL", { circunscripcion: "municipio", deLista: true, circunscripcionInferida: true }],
]);

/**
 * Corporación desconocida: nacional (colores por ranking nacional, sin filtrar unidades sin votos y
 * clave `"00"` en SQL) y de lista (se muestra el voto por lista si la fuente lo trae).
 */
const REGLA_POR_DEFECTO: ReglaCorporacion = { circunscripcion: "nacional", deLista: true };

function reglaDe({ corporacion }: Pick<EleccionRef, "corporacion">): ReglaCorporacion {
  return REGLAS_CORPORACION.get(corporacion) ?? REGLA_POR_DEFECTO;
}

/** Circunscripción de la corporación: nacional, departamento o municipio. */
export function circunscripcionDe(eleccion: Pick<EleccionRef, "corporacion">): Circunscripcion {
  return reglaDe(eleccion).circunscripcion;
}

/** Corporaciones con voto por lista y preferente (Senado, Cámara, Asamblea, Concejo, JAL). */
export function esCorporacionDeLista(eleccion: Pick<EleccionRef, "corporacion">): boolean {
  return reglaDe(eleccion).deLista;
}

/** Largo del prefijo divipole del territorio de la circunscripción: 0 nacional, 2 departamento, 5 municipio. */
export function largoCircunscripcion(eleccion: Pick<EleccionRef, "corporacion">): number {
  return getNivel(circunscripcionDe(eleccion)).longitud;
}

/**
 * Código del territorio de la circunscripción que contiene al ámbito `codigo`: el departamento o el
 * municipio del ámbito. `""` (nacional) si la corporación es nacional o el ámbito es más amplio que
 * su circunscripción (p. ej. Alcaldía a nivel departamental).
 */
export function territorioDeCircunscripcion(eleccion: Pick<EleccionRef, "corporacion">, codigo: string): string {
  const longitud = largoCircunscripcion(eleccion);
  return codigo.length >= longitud ? codigo.slice(0, longitud) : "";
}

/** El ámbito está dentro de la circunscripción (la contiene por completo o es una parte de ella). */
export function ambitoEnCircunscripcion(eleccion: Pick<EleccionRef, "corporacion">, codigo: string): boolean {
  return codigo.length >= largoCircunscripcion(eleccion);
}

/**
 * Las unidades del nivel contienen circunscripciones completas (nivel igual o más amplio que la
 * circunscripción). Ahí una unidad sin votos para un competidor es un lugar donde no estaba en el
 * tarjetón, no una debilidad: p. ej. departamentos para Cámara o municipios para Alcaldía.
 *
 * JAL es la excepción: su circunscripción real (comuna o localidad) no llega en la fuente, así que
 * por debajo del municipio tampoco se sabe dónde competía y ningún nivel la contiene
 * (`circunscripcionInferida`). Antes, el detalle de un candidato de JAL listaba como debilidades
 * zonas y puestos de otras comunas.
 */
export function nivelContieneCircunscripciones(eleccion: Pick<EleccionRef, "corporacion">, nivel: NivelId): boolean {
  const regla = reglaDe(eleccion);
  if (regla.circunscripcionInferida) return true;
  return getNivel(nivel).longitud <= getNivel(regla.circunscripcion).longitud;
}

const TIPIFICACION_PRESIDENCIA = "PRESIDENCIA";

/** Presidencia: un candidato por partido, no aplica la vista por partidos. */
export function admiteDimensionPartido(eleccion: EleccionRef): boolean {
  return eleccion.tipificacion !== TIPIFICACION_PRESIDENCIA;
}

/**
 * La dimensión candidato solo se ofrece cuando el ámbito está **dentro** de la circunscripción:
 * nacional siempre (Presidencia, Senado); Cámara, Asamblea y Gobernación desde el departamento;
 * Alcaldía, Concejo y JAL desde el municipio.
 *
 * Fuera de la circunscripción la lista no compara a nadie —reúne a los candidatos de todas las
 * circunscripciones del país— y no cabe en una respuesta: Concejo 2023 nacional son 95.256
 * candidatos (unos 18 MB, cuatro veces el límite de 4,5 MB de una función en Vercel).
 */
export function admiteDimensionCandidato(eleccion: Pick<EleccionRef, "corporacion">, codigo: string): boolean {
  return ambitoEnCircunscripcion(eleccion, codigo);
}

export function admiteDimension(eleccion: EleccionRef, codigo: string, dimension: Dimension): boolean {
  return dimension === "candidato" ? admiteDimensionCandidato(eleccion, codigo) : admiteDimensionPartido(eleccion);
}

export function dimensionPorDefecto(eleccion: EleccionRef): Dimension {
  return admiteDimensionPartido(eleccion) ? "partido" : "candidato";
}

/**
 * Dimensión que se puede mostrar en el ámbito: la pedida (o la de por defecto) si la admite, y si no
 * la otra. Misma regla en el servidor y en la URL del cliente, para que ambos coincidan.
 */
export function dimensionEfectiva(eleccion: EleccionRef, codigo: string, pedida?: Dimension | null): Dimension {
  const preferida = pedida ?? dimensionPorDefecto(eleccion);
  if (admiteDimension(eleccion, codigo, preferida)) return preferida;
  const alterna: Dimension = preferida === "candidato" ? "partido" : "candidato";
  return admiteDimension(eleccion, codigo, alterna) ? alterna : preferida;
}

/**
 * Mostrar junto a cada candidato el lugar donde compite. Solo cuando la circunscripción es
 * subnacional y el ámbito es más amplio que ella: ahí la lista mezcla candidatos de varias
 * circunscripciones y el lugar los distingue. Dentro de la circunscripción todos comparten territorio
 * y el sufijo sobra (antes dependía de si el código necesitó desambiguarse, así que en una misma
 * lista unos candidatos del mismo municipio lo traían y otros no).
 *
 * Con `admiteDimensionCandidato` vigente es la condición complementaria: la lista de candidatos nunca
 * se pide fuera de su circunscripción, así que hoy ningún candidato lleva sufijo. Se mantiene como
 * regla propia para que la descripción siga siendo coherente si el ámbito se amplía.
 */
export function muestraLugarDeCompetidor(eleccion: Pick<EleccionRef, "corporacion">, codigo: string): boolean {
  return largoCircunscripcion(eleccion) > 0 && !ambitoEnCircunscripcion(eleccion, codigo);
}

/**
 * Clave de un candidato cuyo código tiene un solo nombre en la elección (o es la lista o un voto
 * especial). Los demás llevan el territorio que los separa (ver `PATRON_CLAVE`). La clave solo separa
 * homónimos: el territorio donde compite un candidato se calcula con sus votos
 * (`territoriosDeCompetidores` en `resultados.ts`), porque un código sin desambiguar no lo dice.
 */
export const CLAVE_UNICA = "00";

/**
 * Formatos de `clave` que produce SQL (`ojo_aguila.clave_candidato`): `"00"`; departamento (2
 * dígitos) en circunscripción departamental; municipio (5 dígitos) en Alcaldía y Concejo; municipio,
 * `:` y 6 hexadecimales del nombre normalizado en JAL (la fuente no trae la comuna).
 */
const PATRON_CLAVE = String.raw`(?:\d{2}|\d{5}(?::[0-9a-f]{6})?)`;

/** Id de candidato válido: `partido-candidato-clave`. Sin espacios, comillas ni otros caracteres. */
export const PATRON_ID_CANDIDATO = new RegExp(String.raw`^\d{5}-\d{5}-${PATRON_CLAVE}$`);

/** Id estable de un candidato dentro de una elección. */
export function idCandidato(codPartido: string, codCandidato: string, clave: string): string {
  return `${codPartido}-${codCandidato}-${clave}`;
}
