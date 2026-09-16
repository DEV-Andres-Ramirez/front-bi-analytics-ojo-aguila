import type {
  DetalleCompetidorResponse,
  Dimension,
  EleccionRef,
  GeografiaResponse,
  ResultadosResponse,
} from "@/domain/types";
import { PARAM_DESTINO, RUTA_LOGIN } from "@/lib/destino";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const SESSION_EXPIRED_PARAM = "expirada";

async function apiGet<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${path}?${new URLSearchParams(params)}`, { signal, credentials: "same-origin" });

  if (response.status === 401) {
    // Navegación completa intencional: descarta la caché y el estado del cliente al expirar la sesión.
    const login = new URLSearchParams({
      [SESSION_EXPIRED_PARAM]: "1",
      [PARAM_DESTINO]: `${window.location.pathname}${window.location.search}`,
    });
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`${RUTA_LOGIN}?${login}`);
    throw new ApiError("La sesión expiró", 401);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? "No fue posible obtener la información", response.status);
  }
  return response.json() as Promise<T>;
}

function eleccionParams(eleccion: EleccionRef): Record<string, string> {
  return { t: eleccion.tipificacion, c: eleccion.corporacion, a: eleccion.periodo };
}

export function fetchResultados(eleccion: EleccionRef, codigo: string, dimension: Dimension, signal?: AbortSignal) {
  return apiGet<ResultadosResponse>("/api/resultados", { ...eleccionParams(eleccion), g: codigo, d: dimension }, signal);
}

export function fetchDetalleCompetidor(
  eleccion: EleccionRef,
  codigo: string,
  dimension: Dimension,
  competidorId: string,
  signal?: AbortSignal,
) {
  return apiGet<DetalleCompetidorResponse>(
    "/api/resultados/competidor",
    { ...eleccionParams(eleccion), g: codigo, d: dimension, k: competidorId },
    signal,
  );
}

export function fetchGeografia(signal?: AbortSignal) {
  return apiGet<GeografiaResponse>("/api/geografia", {}, signal);
}
