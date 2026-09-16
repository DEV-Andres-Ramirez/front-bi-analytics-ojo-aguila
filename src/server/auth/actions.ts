"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { destinoSeguro, PARAM_DESTINO } from "@/lib/destino";
import { getEnv } from "@/server/env";
import { crearLimiteIntentos, origenDeSolicitud, type LimiteIntentos } from "./limite-intentos";
import { createSession, deleteSession } from "./session";

export interface LoginState {
  error?: string;
  /** Cambia en cada intento fallido para re-disparar la animación de error. */
  intento?: number;
}

const FAILED_LOGIN_DELAY_MS = 500;
const MAX_INTENTOS_FALLIDOS = 5;
const VENTANA_INTENTOS_MS = 5 * 60 * 1000;

const globalParaLimite = globalThis as unknown as { __ojoAguilaIntentosLogin?: LimiteIntentos };

/** Compartido por el proceso aunque el módulo se evalúe en más de un bundle. */
function intentosLogin(): LimiteIntentos {
  globalParaLimite.__ojoAguilaIntentosLogin ??= crearLimiteIntentos({
    maximo: MAX_INTENTOS_FALLIDOS,
    ventanaMs: VENTANA_INTENTOS_MS,
  });
  return globalParaLimite.__ojoAguilaIntentosLogin;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Comparación en tiempo constante (los digests siempre tienen la misma longitud). */
function tokenValido(token: string): boolean {
  return timingSafeEqual(digest(token), digest(getEnv().ACCESS_TOKEN));
}

export async function login(prev: LoginState, formData: FormData): Promise<LoginState> {
  const intento = (prev.intento ?? 0) + 1;
  const origen = origenDeSolicitud(await headers());
  const limite = intentosLogin();

  // Sin await entre la consulta del bloqueo y el registro del fallo: las solicitudes en paralelo no
  // pueden evaluar más tokens que el máximo permitido.
  if (limite.bloqueado(origen)) {
    return { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.", intento };
  }

  const token = String(formData.get("token") ?? "").trim();
  if (!token) {
    return { error: "Ingresa el token de acceso.", intento };
  }
  if (!tokenValido(token)) {
    limite.registrarFallo(origen);
    await new Promise((resolve) => setTimeout(resolve, FAILED_LOGIN_DELAY_MS));
    return { error: "Token de acceso inválido.", intento };
  }

  limite.reiniciar(origen);
  await createSession();
  redirect(destinoSeguro(formData.get(PARAM_DESTINO)));
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
