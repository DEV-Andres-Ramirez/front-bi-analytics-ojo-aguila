import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { esCodigoGeoValido } from "@/domain/niveles";
import { esIdCompetidorValido } from "@/domain/resultados";
import type { Dimension, EleccionRef } from "@/domain/types";
import { admiteDimension, dimensionPorDefecto } from "@/domain/votos";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth/jwt";

/** Error con estado HTTP y mensaje apto para mostrar al usuario. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const CABECERAS_OK = { "Cache-Control": "private, max-age=3600", Vary: "Cookie" };
const CABECERAS_ERROR = { "Cache-Control": "no-store" };

export function jsonOk<T>(data: T): NextResponse<T> {
  return NextResponse.json(data, { headers: CABECERAS_OK });
}

export function jsonError(status: number, error: string): NextResponse<{ error: string }> {
  return NextResponse.json({ error }, { status, headers: CABECERAS_ERROR });
}

type Handler = (request: NextRequest) => Promise<Response>;

/**
 * Envuelve un Route Handler: exige sesión válida (401) y traduce los errores a JSON
 * (`HttpError` con su estado; cualquier otro, 500 genérico registrado en el log).
 */
export function conSesion(handler: Handler): Handler {
  return async (request) => {
    if (!(await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value))) {
      return jsonError(401, "La sesión no es válida o expiró");
    }
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof HttpError) return jsonError(error.status, error.message);
      console.error(`[api] ${request.method} ${request.nextUrl.pathname}`, error);
      return jsonError(500, "No fue posible obtener la información. Intenta de nuevo.");
    }
  };
}

/** Valida los parámetros de la URL; lanza `HttpError` 400 con el primer problema encontrado. */
export function parseQuery<S extends z.ZodType>(request: NextRequest, schema: S): z.output<S> {
  const resultado = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!resultado.success) {
    throw new HttpError(400, resultado.error.issues[0]?.message ?? "Parámetros inválidos");
  }
  return resultado.data;
}

const LONGITUD_MAXIMA_PARAMETRO = 64;

function parametroTexto(nombre: string) {
  return z
    .string({ error: `Falta el parámetro "${nombre}"` })
    .min(1, `El parámetro "${nombre}" no puede estar vacío`)
    .max(LONGITUD_MAXIMA_PARAMETRO, `El parámetro "${nombre}" es demasiado largo`);
}

const camposAmbito = {
  t: parametroTexto("t"),
  c: parametroTexto("c"),
  a: parametroTexto("a"),
  g: z.string().refine(esCodigoGeoValido, 'El parámetro "g" no es un código geográfico válido').default(""),
  d: z.enum(["candidato", "partido"], { error: 'El parámetro "d" debe ser "candidato" o "partido"' }).optional(),
};

type ParametrosAmbito = z.output<z.ZodObject<typeof camposAmbito>>;

export interface ConsultaResultados {
  eleccion: EleccionRef;
  codigo: string;
  dimension: Dimension;
}

export interface ConsultaCompetidor extends ConsultaResultados {
  competidorId: string;
}

function aConsulta(parametros: ParametrosAmbito): ConsultaResultados {
  const eleccion: EleccionRef = { tipificacion: parametros.t, corporacion: parametros.c, periodo: parametros.a };
  return { eleccion, codigo: parametros.g, dimension: parametros.d ?? dimensionPorDefecto(eleccion) };
}

function dimensionAdmitida(parametros: ParametrosAmbito): boolean {
  const { eleccion, codigo, dimension } = aConsulta(parametros);
  return admiteDimension(eleccion, codigo, dimension);
}

const MENSAJE_DIMENSION_NO_ADMITIDA = 'La dimensión "partido" no está disponible para esta elección';

/** GET /api/resultados?t&c&a&g&d */
export const consultaResultadosSchema = z
  .object(camposAmbito)
  .refine(dimensionAdmitida, MENSAJE_DIMENSION_NO_ADMITIDA)
  .transform(aConsulta);

/** GET /api/resultados/competidor?t&c&a&g&d&k */
export const consultaCompetidorSchema = z
  .object({ ...camposAmbito, k: parametroTexto("k") })
  .refine(dimensionAdmitida, MENSAJE_DIMENSION_NO_ADMITIDA)
  .refine(
    (parametros) => esIdCompetidorValido(parametros.k, aConsulta(parametros).dimension),
    'El parámetro "k" no identifica un competidor de la dimensión solicitada',
  )
  .transform((parametros): ConsultaCompetidor => ({ ...aConsulta(parametros), competidorId: parametros.k }));
