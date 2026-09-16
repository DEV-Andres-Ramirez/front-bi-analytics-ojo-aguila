<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# OJO DE ÁGUILA — Guía para agentes

Dashboard BI de resultados electorales de Colombia. El objetivo es ver cada elección desde lo general (Nacional) hasta lo más específico (Puesto; Mesa cuando la fuente lo permita), con una UX de primer nivel y buen rendimiento sobre unos 45 M de filas. Lee también `README.md` (visión completa) y `database/README.md` (operación de la BD).

## Comandos

```bash
pnpm dev | pnpm build | pnpm start
pnpm lint                 # ESLint flat config (next lint ya no existe)
pnpm typecheck            # next typegen && tsc --noEmit (tipos globales PageProps/LayoutProps/RouteContext)
pnpm test                 # vitest run
pnpm db:migrate | db:refresh | db:verify   # SOLO en local, usan .env
```

Antes de dar un cambio por terminado: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Stack y convenciones de Next 16 que importan aquí

- **Protección de rutas:** `src/proxy.ts` (antes `middleware`) corre en Node. Solo hace verificación optimista del JWT. La verificación real está en `requireSession()` (Server Components) y en `conSesion`/`http.ts` (Route Handlers). Las Server Actions no pasan por el matcher del proxy: toda action que exponga datos debe verificar la sesión.
- **APIs asíncronas:** `cookies()` y `headers()` son async; `params` y `searchParams` son Promises.
- **Sin `cacheComponents`:** no se usa `use cache` ni `unstable_cache`. No agregar caché de servidor persistente sin decisión explícita, porque serviría datos viejos después de `db:refresh`.
- **`next/dynamic`:** exige opciones literales en cada llamada (ver `src/components/charts/lazy.tsx`).
- **Historial:** `window.history.pushState/replaceState` se sincroniza con `useSearchParams` sin ir al servidor; `useFiltrosUrl` lo aprovecha.
- **`next/image`:** `priority` está obsoleto; se usa `loading="eager"` / `fetchPriority`.
- **Tema:** sin `next-themes` (incompatible con React 19.2 / Next 16.2+). Se usa `ThemeScript` en `<head>` + `useTheme` (`useSyncExternalStore`).
- **shadcn:** CLI 4.x, estilo `radix-nova`, base **Radix** (patrón `asChild`). Se agrega con `pnpm dlx shadcn@latest add <comp>`. Después de agregar un componente:
  - Verificar que importe `cn` desde `@/lib/utils` (el CLI generó `from "cn"`, un paquete npm equivocado).
  - Traducir al español los textos accesibles ("Close" → "Cerrar", etc.).
  - No usar el `chart` de shadcn (es Recharts): **las gráficas son Chart.js**.

## Arquitectura por capas (respetar la dirección de dependencias)

```
src/domain/*        Puro (sin React, sin Node, sin "server-only"). Contratos y reglas de negocio. Testeado.
src/server/*        "server-only": env, pool pg, auth, http (handler wrapper), repositories (SQL), services.
src/app/api/*       Route Handlers finos: conSesion + parseo zod → service → jsonOk.
src/app/(dashboard) Server Component: requireSession + getCatalogo → AppHeader + DashboardView.
src/hooks, src/lib  Cliente/compartido: useFiltrosUrl, queries, colores, formato, api-client, csv, destino.
src/components/*    UI: header, dashboard, charts (Chart.js), brand, theme, ui (shadcn).
```

- `src/domain/types.ts` es la **fuente de verdad** de los contratos cliente-servidor. Si cambias una forma de respuesta, cámbiala ahí primero y adapta servidor y cliente.
- Los repositorios solo contienen SQL parametrizado. Los nombres de vista vienen de una whitelist por nivel; nunca interpolar entrada del usuario.
- Los servicios orquestan y memorizan datos pequeños en el proceso con TTL (`memorizar`): geografía, nombres, rankings y zonas únicas por elección. El catálogo se memoriza 10 min en `catalogo.repository.ts`.
- El servidor devuelve los nombres **ya formateados** (`formatNombre`); la UI no los re-formatea. Las etiquetas de catálogo (Cámara, Alcaldía…) usan `formatEtiquetaCatalogo`.

## Dominio electoral (reglas que no se deben romper)

- **Elección** = (tipificación, corporación, periodo). Filtros en cascada estricta Tipificación → Corporación → Año; los datos solo se piden con los tres.
- **Código geográfico** = prefijo divipole: `""` Colombia, 2 departamento, 5 municipio, 7 zona, 9 puesto (los dos últimos caracteres del puesto pueden ser `[0-9A-Z]`). Registro en `src/domain/niveles.ts`; **Mesa** está deshabilitado (la fuente no tiene número de mesa).
- **Tipos de voto** (`votos.ts`): `00996` blanco, `00997` nulo, `00998` no marcado, `00000` lista (solo corporaciones de lista), el resto candidato.
  - Válidos = candidatos + listas + blanco.
  - `pctBlanco` se calcula sobre válidos; `pctNulos` y `pctNoMarcados` sobre el total.
- **Circunscripción por corporación** (`votos.ts`, reflejada en la migración SQL):

  | Circunscripción | Corporaciones |
  |---|---|
  | Nacional | PRIMERA VUELTA, SEGUNDA VUELTA, SENADO |
  | Departamento | CAMARA, ASAMBLEA, GOBERNADOR |
  | Municipio | ALCALDE, CONCEJO, JAL |

  - Uninominales (sin voto lista/preferente): las vueltas presidenciales, ALCALDE, GOBERNADOR.
  - Para colores y detalle, el ranking se toma de la unidad de la circunscripción cuando el ámbito está dentro de ella.
- **`clave`** separa personas distintas que comparten `(cod_partido, cod_candidato)`. Id de candidato: `${codPartido}-${codCandidato}-${clave}`; id de partido: `codPartido`.
  - `'00'` si el código tiene un solo nombre normalizado en la elección.
  - Si tiene varios: el código del departamento (circunscripción departamental), el municipio (Alcaldía y Concejo) o municipio + `:` + hash del nombre (JAL).
- **Dimensión por defecto:** Presidencia → `candidato`; resto → `partido`. Presidencia no admite `partido`, y `candidato` solo se admite dentro de la circunscripción (`admiteDimensionCandidato`); `dimensionEfectiva` resuelve lo mismo en servidor y cliente.
- **Respuesta acotada:** `LIMITE_COMPETIDORES` (1.000) recorta la lista y `totalCompetidores` informa el total; sin eso, Concejo nacional serían 18 MB.
- **Salto de zona única:** un municipio con una sola zona (en esa elección) muestra directamente sus puestos.
- **Empate** (`UnidadResultado.empate`): no se declara ganador. `posicion` en el detalle es un `rank()` y vale `null` si la unidad no tiene votos por competidores.
- **Lugar sin votos** en la elección elegida → 404 "Este lugar no registra votos en la elección seleccionada" (la UI lo muestra como estado vacío con acciones).
- **Colores:** `Competidor.colorIndex` es solo una preferencia. Todo componente debe usar el resolver de `useColoresCompetidores(response)` y no `colorCompetidor(colorIndex)` directamente. El gris es solo para "Otros".

## Base de datos (lee `database/README.md`)

- **Fuente de solo lectura:** `data_reporte.data_electoral_analitica` y `data_reporte.dim_divipole`. **Nunca modificar nada fuera del esquema `ojo_aguila`.**
- **`ojo_aguila`:** tabla `registro_eleccion` (ids permanentes: **no borrar filas**) y vistas materializadas `eleccion`, `candidato`, `partido`, `votos_{departamento,municipio,zona,puesto}` y `geografia`, más auxiliares internas.
- **Consulta típica:** `WHERE eleccion_id = $1 AND padre = $2` sobre la vista del nivel hijo.
- **Refresh:** `pnpm db:refresh` es transaccional y bloquea las vistas unos minutos.
  - **Antes:** confirmar que la fuente tiene filas y que nadie la está recargando (`pb_actualizar_data_election()` hace TRUNCATE + INSERT).
  - **Después:** `pnpm db:verify` debe salir con 0.
- **Cambios de definición:** eliminar solo las vistas afectadas (`DROP MATERIALIZED VIEW ... CASCADE`, nunca `registro_eleccion`) y luego `db:migrate` + `db:refresh` + `db:verify`.

## Seguridad

- **Secretos:** solo en variables de servidor (`src/server/env.ts`); nada `NEXT_PUBLIC_`. No escribir valores reales de `ACCESS_TOKEN`, `AUTH_SECRET` ni `DATABASE_URL` en código, tests, docs ni logs.
- **Login:** digest SHA-256 + `timingSafeEqual`, retardo por fallo y límite de 5 fallos por IP cada 5 min (`limite-intentos.ts`). Redirección posterior al login solo vía `destinoSeguro` (con tests anti redirección abierta).
- **Respuestas de la API:** `private` + `Vary: Cookie`. Los errores internos no se filtran al cliente (500 genérico + `console.error`).

## UI / UX

- **Idioma:** textos en español de Colombia; cifras con `formatNumero`/`formatPct`/`formatPuntos`/`formatCompacto` (locale `es`) y `tabular-nums`.
- **Tema y diseño:**
  - Claro y oscuro obligatorios.
  - Tokens de marca en `globals.css`: dorado del ojo, neutros tinta, tricolor `bg-tricolor`. Chart.js necesita colores hex (`palette.ts`, `use-chart-theme.ts`).
  - Responsive desde 320 px.
  - Respetar `prefers-reduced-motion`.
- **Carga y transiciones:**
  - Skeletons con la forma real.
  - `keepPreviousData` + `FetchingBar` al recargar.
  - Entradas con `tw-animate-css`.
  - Gráficas cargadas con `next/dynamic({ ssr: false })` y precargadas con `precargarGraficas()`.
- **Assets:** `/brand` y `/geo` tienen caché inmutable (`next.config.ts`). Si cambias su contenido, **cambia el nombre del archivo** (p. ej. `colombia-departamentos.v2.json`) y actualiza la referencia.

## Habilitar el nivel Mesa

Ver la sección homónima del `README.md`. Resumen: requiere la columna `codigo_mesa` en la fuente, la vista `votos_mesa` y las mesas en `geografia`, `habilitado: true` en `niveles.ts` (longitud y patrón) y la vista agregada a la whitelist del repositorio.
