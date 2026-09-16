import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionMaxAgeSeconds, signSessionToken, verifySessionToken } from "./jwt";

/** Crea la sesión (solo en Server Actions o Route Handlers). */
export async function createSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await signSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAgeSeconds(),
  });
}

/** Elimina la sesión (solo en Server Actions o Route Handlers). */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function hasValidSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

/** Para Server Components: redirige a /login si no hay sesión válida. */
export async function requireSession(): Promise<void> {
  if (!(await hasValidSession())) redirect("/login");
}
