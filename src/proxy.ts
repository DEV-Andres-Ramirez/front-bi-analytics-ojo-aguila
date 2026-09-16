import { NextResponse, type NextRequest } from "next/server";
import { destinoSeguro, PARAM_DESTINO, RUTA_LOGIN } from "@/lib/destino";
import { SESSION_EXPIRED_PARAM } from "@/lib/api-client";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth/jwt";

/**
 * Verificación optimista: solo valida el JWT de la cookie (firma, emisor y expiración).
 * Las páginas, los Route Handlers y las Server Actions vuelven a verificar la sesión.
 */
export async function proxy(request: NextRequest) {
  if (esServerAction(request)) return NextResponse.next();

  const { pathname, search, searchParams } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const autenticado = await verifySessionToken(token);
  const enLogin = pathname === RUTA_LOGIN;

  if (autenticado) {
    if (!enLogin) return NextResponse.next();
    return NextResponse.redirect(new URL(destinoSeguro(searchParams.get(PARAM_DESTINO)), request.url));
  }
  if (enLogin) return NextResponse.next();

  const login = new URL(RUTA_LOGIN, request.url);
  if (pathname !== "/" || search) login.searchParams.set(PARAM_DESTINO, `${pathname}${search}`);
  if (token) login.searchParams.set(SESSION_EXPIRED_PARAM, "1");

  const respuesta = NextResponse.redirect(login);
  if (token) respuesta.cookies.delete(SESSION_COOKIE);
  return respuesta;
}

/** Redirigir una Server Action rompe su respuesta RSC; cada acción valida la sesión por su cuenta. */
function esServerAction(request: NextRequest): boolean {
  return request.method === "POST" && request.headers.has("next-action");
}

export const config = {
  matcher: [
    // Todo excepto la API (responde 401 en JSON), los recursos de Next, los íconos, los assets públicos y cualquier archivo con extensión.
    "/((?!api(?:/|$)|_next/static|_next/image|brand/|geo/|icon\\.svg|apple-icon\\.png|favicon\\.ico|Logo_Ojo_Aguila\\.jpeg|.*\\.[^/]+$).*)",
  ],
};
