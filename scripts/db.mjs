#!/usr/bin/env node
/**
 * Runner SQL del esquema ojo_aguila.
 *
 *   node --env-file=.env scripts/db.mjs <migrate|refresh|verify>
 *
 * Cada archivo SQL se divide en pasos con la marca `-- @paso: descripción`
 * y cada paso se envía como una sola consulta, mostrando su duración.
 * `refresh` ejecuta todos sus pasos en una transacción: si uno falla, se revierte todo.
 * En `verify`, las filas con `control = 'FALLA'` hacen terminar con código 1.
 * Se ejecuta en local (nunca desde Vercel): las consultas pueden tardar minutos.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { styleText } from "node:util";
import pg from "pg";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR_DATABASE = path.join(RAIZ, "database");
const MARCA_PASO = /^--\s*@paso:\s*(.+?)\s*$/;
const VALORES_FALSOS = new Set(["false", "0", "no", "off", "n", "disabled"]);
const TIPOS_NUMERICOS = new Set([
  pg.types.builtins.INT2,
  pg.types.builtins.INT4,
  pg.types.builtins.INT8,
  pg.types.builtins.NUMERIC,
]);
const numeroCo = new Intl.NumberFormat("es-CO");

const COMANDOS = {
  migrate: {
    descripcion: "Crea el esquema ojo_aguila (idempotente, sin datos)",
    archivos: listarMigraciones,
  },
  refresh: {
    descripcion: "Recalcula las vistas materializadas desde data_reporte (en una transacción)",
    archivos: async () => [path.join(DIR_DATABASE, "refresh.sql")],
    transaccion: true,
  },
  verify: {
    descripcion: "Ejecuta los controles de calidad",
    archivos: async () => [path.join(DIR_DATABASE, "verify.sql")],
    mostrarResultados: true,
  },
};

class ErrorPaso extends Error {
  constructor(paso, causa) {
    super(causa.message, { cause: causa });
    this.paso = paso;
  }
}

async function listarMigraciones() {
  const dir = path.join(DIR_DATABASE, "migrations");
  const nombres = (await readdir(dir)).filter((nombre) => nombre.endsWith(".sql")).sort();
  return nombres.map((nombre) => path.join(dir, nombre));
}

/** Divide un archivo SQL en pasos según la marca `-- @paso:`. */
function dividirEnPasos(sql, archivo) {
  const pasos = [];
  let actual = null;
  for (const [indice, linea] of sql.split(/\r?\n/).entries()) {
    const marca = linea.match(MARCA_PASO);
    if (marca) {
      actual = { nombre: marca[1], archivo, lineaInicial: indice + 2, lineas: [] };
      pasos.push(actual);
    } else if (actual) {
      actual.lineas.push(linea);
    } else if (linea.trim() && !linea.trim().startsWith("--")) {
      throw new Error(`${path.relative(RAIZ, archivo)}:${indice + 1}: SQL fuera de un bloque "-- @paso:"`);
    }
  }
  return pasos
    .map(({ lineas, ...paso }) => ({ ...paso, sql: lineas.join("\n").trimEnd() }))
    .filter((paso) => paso.sql.trim());
}

function formatearDuracion(ms) {
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)} s`;
  const minutos = Math.floor(ms / 60_000);
  const segundos = Math.round((ms % 60_000) / 1_000);
  return `${minutos} min ${String(segundos).padStart(2, "0")} s`;
}

function usaSsl() {
  const valor = (process.env.DATABASE_SSL ?? "true").trim().toLowerCase();
  return !VALORES_FALSOS.has(valor);
}

/** Con DATABASE_CA_CERT (PEM) se verifica el certificado del servidor; sin ella se cifra sin verificar. */
function opcionesSsl() {
  if (!usaSsl()) return false;
  const ca = process.env.DATABASE_CA_CERT?.replaceAll("\\n", "\n").trim();
  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: false };
}

function configuracionConexion() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL. Ejecute con: node --env-file=.env scripts/db.mjs <comando>");
  }
  return {
    connectionString,
    ssl: opcionesSsl(),
    application_name: "ojo-aguila-db",
    connectionTimeoutMillis: 15_000,
  };
}

async function abrirSesion() {
  const client = new pg.Client(configuracionConexion());
  await client.connect();
  client.on("notice", (aviso) => console.log(styleText("dim", `    aviso: ${aviso.message}`)));
  await client.query(`
    SET statement_timeout = 0;
    SET work_mem = '512MB';
    SET max_parallel_workers_per_gather = 4;
  `);
  return client;
}

/** Cancela la consulta en curso desde otra conexión (Ctrl+C durante un REFRESH largo). */
async function cancelarConsulta(pid) {
  const control = new pg.Client(configuracionConexion());
  try {
    await control.connect();
    await control.query("SELECT pg_cancel_backend($1)", [pid]);
  } finally {
    await control.end().catch(() => {});
  }
}

function formatearFila(fila, campos) {
  const resultado = {};
  for (const campo of campos) {
    const valor = fila[campo.name];
    const esNumero = TIPOS_NUMERICOS.has(campo.dataTypeID) && valor !== null && valor !== "";
    resultado[campo.name] = esNumero ? numeroCo.format(Number(valor)) : valor;
  }
  return resultado;
}

/** Imprime las filas y devuelve cuántas tienen control = 'FALLA'. */
function mostrarResultados(resultados) {
  let fallas = 0;
  for (const { rows, fields } of resultados) {
    if (!fields?.length) continue;
    if (!rows.length) {
      console.log(styleText("dim", "    (sin filas)"));
      continue;
    }
    console.table(rows.map((fila) => formatearFila(fila, fields)));
    fallas += rows.filter((fila) => fila.control === "FALLA").length;
  }
  return fallas;
}

function describirError(error, paso) {
  const causa = error.cause ?? error;
  const lineas = [styleText("red", `✗ Falló "${paso.nombre}" (${path.relative(RAIZ, paso.archivo)})`), `  ${causa.message}`];
  if (causa.code) lineas.push(`  código: ${causa.code}`);
  if (causa.detail) lineas.push(`  detalle: ${causa.detail}`);
  if (causa.hint) lineas.push(`  sugerencia: ${causa.hint}`);
  if (causa.position) {
    const previo = paso.sql.slice(0, Number(causa.position) - 1).split("\n");
    const linea = paso.lineaInicial + previo.length - 1;
    const texto = paso.sql.split("\n")[previo.length - 1]?.trim();
    lineas.push(`  en ${path.relative(RAIZ, paso.archivo)}:${linea}: ${texto}`);
  }
  return lineas.join("\n");
}

async function ejecutar(nombreComando) {
  const comando = COMANDOS[nombreComando];
  const archivos = await comando.archivos();
  const pasos = [];
  for (const archivo of archivos) {
    pasos.push(...dividirEnPasos(await readFile(archivo, "utf8"), archivo));
  }
  if (!pasos.length) throw new Error(`No hay pasos para ejecutar en: ${archivos.join(", ")}`);

  console.log(styleText("bold", `\nOJO DE ÁGUILA · db:${nombreComando} — ${comando.descripcion}`));
  const client = await abrirSesion();
  let interrumpido = false;
  const alInterrumpir = () => {
    if (interrumpido) process.exit(130);
    interrumpido = true;
    console.error(styleText("yellow", "\nCancelando la consulta en curso… (Ctrl+C de nuevo para salir de inmediato)"));
    cancelarConsulta(client.processID).catch((error) => console.error(`No se pudo cancelar: ${error.message}`));
  };
  process.on("SIGINT", alInterrumpir);

  const tiempos = [];
  let fallas = 0;
  const inicio = performance.now();
  try {
    if (comando.transaccion) await client.query("BEGIN");
    for (const [indice, paso] of pasos.entries()) {
      if (interrumpido) throw new Error("Ejecución interrumpida por el usuario");
      console.log(`\n${styleText("cyan", `▸ [${indice + 1}/${pasos.length}]`)} ${paso.nombre}`);
      const inicioPaso = performance.now();
      let resultado;
      try {
        resultado = await client.query(paso.sql);
      } catch (error) {
        throw new ErrorPaso(paso, error);
      }
      const duracion = performance.now() - inicioPaso;
      tiempos.push({ paso: paso.nombre, duracion: formatearDuracion(duracion) });
      if (comando.mostrarResultados) {
        fallas += mostrarResultados(Array.isArray(resultado) ? resultado : [resultado]);
      }
      console.log(styleText("green", `  ✓ ${formatearDuracion(duracion)}`));
    }
    if (comando.transaccion) {
      const inicioCommit = performance.now();
      await client.query("COMMIT");
      tiempos.push({ paso: "COMMIT", duracion: formatearDuracion(performance.now() - inicioCommit) });
    }
  } catch (error) {
    if (comando.transaccion) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(styleText("yellow", "\nTransacción revertida: las vistas conservan los datos anteriores."));
    }
    throw error;
  } finally {
    process.off("SIGINT", alInterrumpir);
    await client.end().catch(() => {});
  }

  console.log(styleText("bold", `\nResumen (${formatearDuracion(performance.now() - inicio)} en total)`));
  console.table(tiempos);
  if (fallas > 0) {
    console.error(styleText("red", `✗ ${fallas} fila(s) con control = FALLA`));
    return 1;
  }
  return 0;
}

async function main() {
  const [nombreComando] = process.argv.slice(2);
  if (!Object.hasOwn(COMANDOS, nombreComando ?? "")) {
    const ayuda = Object.entries(COMANDOS).map(([nombre, { descripcion }]) => `  ${nombre.padEnd(8)} ${descripcion}`);
    console.error(["Uso: node --env-file=.env scripts/db.mjs <comando>", "", "Comandos:", ...ayuda].join("\n"));
    return 1;
  }
  try {
    return await ejecutar(nombreComando);
  } catch (error) {
    console.error(error instanceof ErrorPaso ? describirError(error, error.paso) : styleText("red", `✗ ${error.message}`));
    return 1;
  }
}

process.exitCode = await main();
