export const RUTA_LOGIN = "/login";

/** Parámetro de /login con la ruta interna a la que se vuelve después de autenticarse. */
export const PARAM_DESTINO = "desde";

const ORIGEN_INTERNO = "http://ojo-aguila.local";

/**
 * Reduce un destino no confiable a una ruta interna (pathname + query).
 * Descarta URLs absolutas o de protocolo relativo (redirección abierta) y la propia pantalla de login.
 */
export function destinoSeguro(valor: unknown): string {
  if (typeof valor !== "string" || !valor.startsWith("/")) return "/";
  try {
    const url = new URL(valor, ORIGEN_INTERNO);
    const esLogin = url.pathname === RUTA_LOGIN || url.pathname.startsWith(`${RUTA_LOGIN}/`);
    if (url.origin !== ORIGEN_INTERNO || esLogin) return "/";
    const ruta = `${url.pathname}${url.search}`;
    // La normalización puede producir "//host" ("/.//host", "/..//host", "/./\host"): el navegador
    // lo resolvería como URL de protocolo relativo hacia otro sitio.
    return ruta.startsWith("//") ? "/" : ruta;
  } catch {
    return "/";
  }
}
