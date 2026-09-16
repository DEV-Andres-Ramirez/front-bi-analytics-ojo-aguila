import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { getEnv } from "@/server/env";

export const SESSION_COOKIE = "oda_session";

const ISSUER = "ojo-aguila";
const AUDIENCE = "ojo-aguila-dashboard";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().AUTH_SECRET);
}

export function sessionMaxAgeSeconds(): number {
  return getEnv().SESSION_TTL_HOURS * 60 * 60;
}

export async function signSessionToken(): Promise<string> {
  return new SignJWT({ scope: "dashboard" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${sessionMaxAgeSeconds()}s`)
    .sign(secretKey());
}

/** Verifica firma, emisor, audiencia y expiración. Nunca lanza. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}
