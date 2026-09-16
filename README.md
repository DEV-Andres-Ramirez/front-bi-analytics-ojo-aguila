# OJO DE ÁGUILA

**Inteligencia electoral de Colombia.** Dashboard BI para explorar los resultados históricos de las elecciones colombianas, desde el total nacional hasta el puesto de votación.

<p align="center">
  <img src="public/brand/ojo-aguila.svg" alt="Logo Ojo de Águila" width="140" />
</p>

- **Elecciones disponibles:** Presidencia (1.ª y 2.ª vuelta: 2018, 2022, 2026), Congreso (Senado y Cámara: 2014, 2018, 2022) y Territoriales 2023 (Alcaldía, Gobernación, Asamblea, Concejo y JAL). Se toman automáticamente de la base de datos.
- **Niveles geográficos:** Nacional → Departamento → Municipio → Zona → Puesto. El nivel **Mesa** está preparado, pero deshabilitado porque la fuente no trae número de mesa (ver [Habilitar Mesa](#habilitar-el-nivel-mesa)).
- **Análisis:** KPIs (votos totales, válidos, blanco, nulos, no marcados, líder y margen), ranking de candidatos o partidos, composición del voto, mapa de ganadores por departamento, distribución territorial, voto por lista frente a voto preferente, tabla territorial con exportación CSV y detalle de cada competidor (dónde es fuerte o débil).

---

## Tabla de contenido

1. [Stack](#stack)
2. [Puesta en marcha](#puesta-en-marcha)
3. [Variables de entorno](#variables-de-entorno)
4. [Scripts](#scripts)
5. [Arquitectura](#arquitectura)
6. [Modelo de datos](#modelo-de-datos)
7. [API](#api)
8. [UI / UX](#ui--ux)
9. [Seguridad](#seguridad)
10. [Despliegue en Vercel](#despliegue-en-vercel)
11. [Operación de la base de datos](#operación-de-la-base-de-datos)
12. [Habilitar el nivel Mesa](#habilitar-el-nivel-mesa)
13. [Hallazgos de la fuente](#hallazgos-de-la-fuente)
14. [Créditos](#créditos)

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | **Next.js 16.3** (App Router, `src/app`, `proxy.ts`, Turbopack) · React 19.2 · TypeScript estricto |
| UI | **shadcn/ui** (estilo `radix-nova`, base Radix) · Tailwind CSS v4 · `tw-animate-css` · lucide-react · sonner |
| Gráficas | **Chart.js 4** · `react-chartjs-2` · `chartjs-chart-geo` (mapa coroplético) |
| Datos en cliente | TanStack Query 5 (caché, `keepPreviousData`, precarga) |
| Servidor | Route Handlers + Server Actions · `pg` (PostgreSQL) · `zod` · `jose` (sesión JWT) · `@vercel/functions` |
| Base de datos | PostgreSQL 16: fuente `data_reporte` + esquema propio `ojo_aguila` con vistas materializadas |
| Pruebas | Vitest (dominio, formato, seguridad, utilidades de UI) |

> **Importante:** Next.js 16 cambia APIs respecto a versiones anteriores (`middleware` pasa a llamarse `proxy`, `cookies()` es asíncrono, `params` es una Promise, `next lint` ya no existe). La documentación de la versión instalada está en `node_modules/next/dist/docs/`.

## Puesta en marcha

Requisitos: Node ≥ 20.9 (se usa 24), pnpm 11 y acceso de red a la base de datos.

```bash
pnpm install
cp .env.example .env      # completar los valores (ver abajo)
pnpm db:migrate           # solo la primera vez: crea el esquema ojo_aguila
pnpm db:refresh           # calcula las vistas materializadas (~2-3 min)
pnpm db:verify            # controles de calidad (exit 0 = OK)
pnpm dev                  # http://localhost:3000
```

Para entrar se usa el token de acceso definido en `ACCESS_TOKEN`.

## Variables de entorno

Todas son **solo de servidor**; ninguna usa el prefijo `NEXT_PUBLIC_`. `.env` está en `.gitignore`; `.env.example` es la plantilla versionada.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | `postgresql://usuario:password@host:puerto/db_historico_territorial`. **Codificar** los caracteres especiales de la contraseña (`$` → `%24`, `@` → `%40`…) y **no** incluir `sslmode`. |
| `DATABASE_SSL` | No (`true`) | Cifra la conexión con TLS. |
| `DATABASE_CA_CERT` | No | PEM de la CA del servidor. Si se define, se verifica el certificado (`rejectUnauthorized: true`) y `DATABASE_URL` debe usar el nombre DNS del servidor, no la IP. Admite saltos de línea escritos como `\n`. |
| `DATABASE_POOL_MAX` | No (`5`) | Conexiones máximas por instancia. |
| `ACCESS_TOKEN` | Sí | Token único de acceso al dashboard. |
| `AUTH_SECRET` | Sí (≥ 32 caracteres) | Secreto HS256 que firma la sesión. Se genera con `openssl rand -base64 32`. Al rotarlo se invalidan todas las sesiones. |
| `SESSION_TTL_HOURS` | No (`12`) | Duración de la sesión. |

El `.env` local está listo para importarse en Vercel (**Project → Settings → Environment Variables → Import .env**).

## Scripts

| Comando | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` / `pnpm start` | Build y servidor de producción |
| `pnpm lint` | ESLint (flat config) |
| `pnpm typecheck` | `next typegen` + `tsc --noEmit` (genera los tipos globales `PageProps`, `LayoutProps` y `RouteContext`) |
| `pnpm test` | Vitest |
| `pnpm db:migrate` | Crea o actualiza el esquema `ojo_aguila` (idempotente, vistas `WITH NO DATA`) |
| `pnpm db:refresh` | Recalcula todas las vistas en **una sola transacción** |
| `pnpm db:verify` | Controles de calidad; sale con código 1 si algún control falla |

Los scripts `db:*` se ejecutan **en local** (usan `node --env-file=.env scripts/db.mjs`), nunca desde Vercel.

## Arquitectura

```
Navegador ──► proxy.ts (verificación optimista del JWT; redirige a /login)
   │
   ├─ /login ─────────► Server Action login() ─► cookie httpOnly (JWT HS256)
   │
   └─ / (Server Component: requireSession + catálogo)
        ├─ AppHeader: filtros en cascada (URL ?t&c&a) · buscador ⌘K · tema · usuario
        └─ DashboardView (cliente, TanStack Query)
              └─ GET /api/resultados · /api/resultados/competidor · /api/geografia
                     └─ http.ts (sesión + zod) ─► services ─► repositories (SQL) ─► ojo_aguila.*
```

### Estructura de carpetas

```
database/                 SQL del esquema ojo_aguila (migrations/, refresh.sql, verify.sql, README.md)
scripts/db.mjs            Runner de migrate | refresh | verify
public/brand/             Logo vectorial (completo y simplificado)
public/geo/               TopoJSON de departamentos (nombre versionado, caché inmutable)
src/
  proxy.ts                Protección de rutas (Next 16)
  app/
    layout.tsx            Fuentes, metadatos, script de tema, Providers
    globals.css           Tokens de marca (oklch) claro/oscuro, utilidades y animaciones
    icon.svg, apple-icon.png
    login/                Pantalla de acceso (panel de marca + formulario)
    (dashboard)/          Página principal, loading, error
    api/                  Route Handlers: resultados, resultados/competidor, geografia
  domain/                 Lógica PURA y testeable (sin server-only)
    types.ts              Contratos de la API (fuente de verdad cliente/servidor)
    niveles.ts            Jerarquía geográfica y códigos divipole (Mesa deshabilitado)
    votos.ts              Tipos de voto, circunscripción por corporación, dimensión por defecto
    resultados.ts         KPIs, ranking, ganador/segundo/margen/empate, voto lista, desempeño
    departamentos.ts      Código Registraduría → ISO 3166-2 (mapa)
  server/                 Solo servidor
    env.ts                Validación zod de variables de entorno
    db/pool.ts            Pool pg singleton (SSL, timeouts, attachDatabasePool)
    auth/                 JWT, sesión, Server Actions login/logout, límite de intentos
    http.ts               Envoltorio de handlers: sesión, zod, errores y cabeceras de caché
    repositories/         SQL parametrizado (catálogo, resultados, nombres, geografía)
    services/             Orquestación y memorias en proceso con TTL
  hooks/                  useFiltrosUrl (estado en URL), queries, colores y count-up
  lib/                    format (es-CO), palette, api-client, csv, destino seguro, utils
  components/
    ui/                   Componentes shadcn (generados; textos accesibles traducidos)
    brand/ theme/         Logo, tema claro/oscuro sin next-themes
    header/               Header, filtros en cascada, ⌘K, tema, menú de usuario
    dashboard/            Vista de resultados, KPIs, breadcrumb, tablas, hoja de competidor
    charts/               Chart.js: ranking, composición, distribución, mapa, voto lista, desempeño
```

### Decisiones clave

- **Rendimiento:** la fuente tiene unos 45 M de filas. El esquema `ojo_aguila` precalcula los votos por nivel (puesto, zona, municipio, departamento). Cada consulta de la API lee **solo los hijos de un código** (`WHERE eleccion_id = $1 AND padre = $2`) mediante índices únicos y tarda milisegundos en la BD.
- **Sin caché de servidor persistente:** no se usa `cacheComponents`, `use cache` ni `unstable_cache`, porque las vistas ya responden rápido y así evitamos servir datos viejos después de un refresh. Solo hay memorias en proceso con TTL para datos pequeños (catálogo 10 min; geografía, nombres y rankings 1 h), el navegador cachea con `Cache-Control: private, max-age=3600` y TanStack Query usa `staleTime: Infinity`.
- **Catálogo sin endpoint:** el Server Component de la página carga las 17 elecciones y las pasa a los filtros. Por eso la cascada Tipificación → Corporación → Año es instantánea y los datos solo se piden cuando están los tres filtros.
- **Estado en la URL:** `?t=&c=&a=&g=&d=` (tipificación, corporación, año, código geográfico y dimensión). Se actualiza con `window.history.pushState/replaceState`, que Next sincroniza sin ir al servidor. Los enlaces se pueden compartir y atrás/adelante funcionan.
- **Código geográfico = prefijo divipole:** `""` Colombia, `DD` departamento, `DDMMM` municipio, `DDMMMZZ` zona, `DDMMMZZPP` puesto (los dos últimos pueden ser alfanuméricos).

## Modelo de datos

### Fuente (`data_reporte`, solo lectura)

- `data_electoral_analitica`: una fila por **mesa** × candidato (`tipificacion`, `periodo`, `nombre_corporacion`, `divipole`, `codigo_partido`, `nombre_partido`, `codigo_candidato`, `nombre_candidato`, `total_votos`).
- `dim_divipole`: puestos de votación (`divipole` = `DD MMM ZZ PP`, nombres de departamento, municipio y puesto).

Códigos especiales: `00996` blanco, `00997` nulos, `00998` no marcados; `00000` es el voto solo por la lista (corporaciones de lista).

### Esquema propio (`ojo_aguila`)

Detalle completo en [`database/README.md`](database/README.md).

| Objeto | Uso |
|---|---|
| `registro_eleccion` (tabla) | Id **permanente** por elección. No se deben borrar filas. |
| `eleccion` | Catálogo de elecciones presentes en la fuente |
| `candidato`, `partido` | Nombres más frecuentes por código (y por `clave`) |
| `votos_departamento` / `votos_municipio` / `votos_zona` / `votos_puesto` | Votos por unidad con `(eleccion_id, padre, ambito, cod_partido, cod_candidato, clave, votos)` |
| `geografia` | Nombres limpios por código (departamentos con tildes oficiales) |

**Regla de circunscripción** (`src/domain/votos.ts`, reflejada en SQL):

| Circunscripción | Corporaciones | Colores y detalle del candidato |
|---|---|---|
| Nacional | Primera/Segunda vuelta, Senado | Ranking nacional |
| Departamental | Cámara, Asamblea, Gobernación | Ranking del departamento |
| Municipal | Alcaldía, Concejo, JAL | Ranking del municipio |

Cuando un mismo código de candidato trae varios nombres en una elección, la columna `clave` los separa según la circunscripción: departamento en las departamentales, municipio en Alcaldía y Concejo, y municipio + nombre en JAL, porque la fuente no trae la comuna. Así no se mezclan personas distintas bajo un mismo id. Presidencia y los uninominales (Alcaldía, Gobernación) no tienen voto por lista.

## API

Todas las rutas exigen sesión válida (401 JSON en caso contrario), validan parámetros con zod (400) y responden `Cache-Control: private, max-age=3600` + `Vary: Cookie`.

| Ruta | Parámetros | Respuesta (`src/domain/types.ts`) |
|---|---|---|
| `GET /api/resultados` | `t`, `c`, `a`, `g` (código, opcional), `d` (`candidato` \| `partido`, opcional) | `ResultadosResponse`: ámbito y ruta, KPIs, competidores (máximo 1.000, con `totalCompetidores`), voto lista, unidades hijas y top 5 |
| `GET /api/resultados/competidor` | `t`, `c`, `a`, `g`, `d`, `k` (id del competidor) | `DetalleCompetidorResponse`: desempeño del competidor por unidad hija |
| `GET /api/geografia` | — | `GeografiaResponse`: `[codigo, nombre]` de departamentos, municipios y puestos (para ⌘K) |

Errores 404: elección inexistente, unidad inexistente o **lugar sin votos en la elección elegida**. Error 400: dimensión no disponible en ese ámbito. Reglas relevantes:

- **Dimensión candidato solo dentro de su circunscripción.** Cámara, Asamblea y Gobernación exigen estar en un departamento; Alcaldía, Concejo y JAL, en un municipio. Fuera de ahí la lista mezclaría candidatos de circunscripciones distintas (Concejo nacional son 95.256) y no cabría en una respuesta. La UI deshabilita la opción con un tooltip y cae a Partidos.
- **Respuesta acotada:** máximo 1.000 competidores por respuesta; `totalCompetidores` trae el total y la tabla avisa cuando la lista viene recortada. El peor caso medido pesa 223 KB, muy por debajo del límite de 4,5 MB de Vercel.
- Si un municipio tiene una sola zona, se salta ese nivel (se calcula por elección).
- Los empates (`empate: true`) no declaran ganador; `posicion` comparte valor entre empatados y es `null` si la unidad no tiene votos por competidores.
- El detalle de un competidor omite las unidades donde no estaba en el tarjetón, solo cuando compite en un único territorio (las circunscripciones especiales de Cámara abarcan varios y no se filtran).
- Las proporciones se redondean a 5 decimales.

## UI / UX

- **Login:** pantalla dividida con panel de marca (logo animado, cinta tricolor y beneficios) y formulario con mostrar/ocultar token, estado de carga, animación de error, límite de intentos y aviso de sesión expirada.
- **Header sticky** con efecto glass y línea tricolor:
  - **Stepper 1 → 2 → 3:** cada paso se habilita al completar el anterior, con tooltip y resaltado del siguiente.
  - **Buscador ⌘K** de lugares por nombre, código o contexto.
  - **Tema** claro, oscuro o del sistema, y cierre de sesión.
  - **Móvil:** los filtros se abren en un `Sheet`.
- **Estado vacío guiado** hasta completar los filtros; luego la consulta se lanza sola.
- **Vista de resultados:**
  - Breadcrumb geográfico y pills de nivel (Mesa deshabilitado con explicación).
  - KPIs con count-up.
  - Gráficas Chart.js: ranking, dona, mapa y distribución 100 %.
  - Tabla territorial con búsqueda, orden, paginación, CSV, clic para bajar de nivel y precarga al pasar el cursor.
  - Tabla de competidores y hoja lateral de detalle.
- **Transiciones:**
  - Skeletons con la forma real.
  - La vista anterior se atenúa con barra de progreso mientras carga la nueva (`keepPreviousData`).
  - Entradas animadas y respeto de `prefers-reduced-motion`.
- **Colores:** paleta categórica validada para daltonismo (`src/lib/palette.ts`), resuelta por respuesta con `useColoresCompetidores` para que dos competidores visibles no compartan color. El gris queda reservado para "Otros".
- **Accesibilidad:** textos en español (incluidos los de shadcn), navegación por teclado en tablas y gráficas, `aria-label` y restauración de foco.

## Seguridad

- **Sesión:** JWT HS256 (`jose`) en cookie `oda_session` httpOnly, `secure` en producción y `sameSite=lax`, con emisor, audiencia y expiración.
- **Comprobación del token:** se comparan los digests SHA-256 con `timingSafeEqual`, con un retardo de 500 ms por fallo y un límite de **5 intentos fallidos por IP cada 5 minutos**. El límite vive en la memoria de cada instancia; en producción, complementarlo con Vercel Firewall.
- **Autorización:** `proxy.ts` hace la verificación optimista; `requireSession` (página) y cada Route Handler vuelven a verificar.
- **Redirecciones:** `?desde=` después del login pasa por `destinoSeguro` (evita redirecciones abiertas, con tests).
- **SQL:** consultas parametrizadas y vistas elegidas desde una whitelist por nivel.
- **Cabeceras:** `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY` y `Permissions-Policy`; caché inmutable para `/brand` y `/geo`. Sitio `noindex`.
- **Recomendaciones de producción:**
  1. Rotar `ACCESS_TOKEN` por uno largo y aleatorio.
  2. Crear una regla de rate limit en Vercel Firewall para `POST /login` con cabecera `next-action`, por ejemplo 10 por minuto por IP.
  3. Usar un rol de BD **de solo lectura** para la app: [ver SQL](database/README.md) y sección siguiente.
  4. Configurar `DATABASE_CA_CERT`.

## Despliegue en Vercel

1. Importar el repositorio en Vercel (framework Next.js, pnpm detectado automáticamente).
2. **Settings → Environment Variables → Import .env** con el `.env` local (Production y Preview).
3. Mantener la región `iad1` (`vercel.json`), cercana a la BD en AWS us-east-1.
4. Desplegar. El build no necesita acceso a la base de datos: las páginas que consultan datos son dinámicas.
5. (Recomendado) Crear un rol de solo lectura y usarlo en la `DATABASE_URL` de Vercel:

```sql
CREATE ROLE ojo_aguila_app LOGIN PASSWORD '<aleatoria>';
GRANT CONNECT ON DATABASE db_historico_territorial TO ojo_aguila_app;
GRANT USAGE ON SCHEMA ojo_aguila TO ojo_aguila_app;
GRANT SELECT ON ALL TABLES IN SCHEMA ojo_aguila TO ojo_aguila_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA ojo_aguila GRANT SELECT ON TABLES TO ojo_aguila_app;
ALTER ROLE ojo_aguila_app SET default_transaction_read_only = on;
```

La credencial de administrador se usa solo en local para `pnpm db:*`.

## Operación de la base de datos

Cuando el equipo de datos **recargue la fuente** (`data_reporte.pb_actualizar_data_election()`):

1. Esperar a que termine la recarga. Confirmar que la fuente tiene filas: `SELECT EXISTS (SELECT 1 FROM data_reporte.data_electoral_analitica)`.
2. Ejecutar `pnpm db:refresh && pnpm db:verify` en una ventana de bajo tráfico. La operación es atómica, pero bloquea las vistas unos minutos.
3. Las memorias en proceso de la API expiran solas (máximo 1 h); para verlo al instante, redesplegar o reiniciar instancias.

Las elecciones nuevas aparecen solas en los filtros con un id permanente. Si una corporación nueva no está en la tabla de circunscripciones de `src/domain/votos.ts` (y su equivalente SQL), se trata como nacional y de lista: conviene agregarla.

## Habilitar el nivel Mesa

La fuente no incluye número de mesa y los candidatos con 0 votos no tienen fila, así que las mesas no se pueden reconstruir. Cuando la tabla fuente tenga `codigo_mesa`:

1. **SQL:** crear `ojo_aguila.votos_mesa` (`padre` = divipole de 9, `ambito` = divipole + mesa) con su índice único, añadirla a `refresh.sql` y `verify.sql`, y agregar las mesas a `geografia`.
2. **Dominio:** en `src/domain/niveles.ts`, poner `habilitado: true` en `mesa` y ajustar su `longitud` y patrón de código.
3. **Repositorios:** añadir la vista `votos_mesa` a la whitelist por nivel (`resultados.repository.ts`).
4. **UI:** la pill "Mesa" del breadcrumb y la tabla territorial funcionan con el registro de niveles; revisar textos del estado de hoja.

## Hallazgos de la fuente

- **Presidencia duplicada ×2:** existió hasta la recarga del 15-09-2026, que la corrigió. `db:verify` mantiene un control informativo.
- **Nombres:** vienen sin tildes y con variantes de escritura (se toma la más frecuente). El departamento `25` venía truncado (`NORTE DE SAN`), por eso `geografia` usa nombres oficiales de departamento.
- **Registros especiales:** hay registros `TERRITORIAL` y `000000000` con 0 votos (se excluyen), y existe un departamento `18` sin nombre.
- **Puestos alfanuméricos:** 201 puestos tienen códigos con letras (`0100199A1`).
- **Colisiones de códigos:** los códigos de candidato se repiten entre circunscripciones (Cámara, Territoriales) y se resuelven con `clave`.
- **JAL sin comuna:** la fuente no trae la comuna/localidad de JAL; los candidatos se separan por municipio y nombre.

## Créditos

- Datos: Registraduría Nacional del Estado Civil (vía `db_historico_territorial`).
- Mapa: [geoBoundaries](https://www.geoboundaries.org/) / OpenStreetMap, licencia ODbL.
- Desarrollado por LinkTic.
