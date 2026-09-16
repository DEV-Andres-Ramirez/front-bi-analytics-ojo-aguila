import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { Pool, types, type PoolConfig, type QueryResultRow } from "pg";
import { getEnv, type ServerEnv } from "@/server/env";

// Sumas de votos (bigint/numeric) caben en Number: se parsean como número.
types.setTypeParser(types.builtins.INT8, (value) => Number(value));
types.setTypeParser(types.builtins.NUMERIC, (value) => Number(value));

const globalForPool = globalThis as unknown as { __ojoAguilaPool?: Pool };

/** Con DATABASE_CA_CERT se verifica el certificado del servidor; sin ella se cifra sin verificar. */
function opcionesSsl({ DATABASE_SSL, DATABASE_CA_CERT }: ServerEnv): PoolConfig["ssl"] {
  if (!DATABASE_SSL) return false;
  return DATABASE_CA_CERT ? { rejectUnauthorized: true, ca: DATABASE_CA_CERT } : { rejectUnauthorized: false };
}

function createPool(): Pool {
  const env = getEnv();
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: opcionesSsl(env),
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
    application_name: "ojo-aguila",
  });
  pool.on("error", (error) => console.error("[db] Error en cliente inactivo del pool", error));
  attachDatabasePool(pool);
  return pool;
}

export function getPool(): Pool {
  globalForPool.__ojoAguilaPool ??= createPool();
  return globalForPool.__ojoAguilaPool;
}

/** Ejecuta una consulta parametrizada y retorna las filas. */
export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}
