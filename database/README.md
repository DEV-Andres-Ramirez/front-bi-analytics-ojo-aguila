# Base de datos — esquema `ojo_aguila`

Capa de lectura precalculada sobre `data_reporte` (45,5 M filas). La API consulta solo este esquema; `data_reporte` no se modifica.

## Comandos

Se ejecutan en local, con `.env` configurado. Nunca se ejecutan desde Vercel.

| Comando | Qué hace |
|---|---|
| `pnpm db:migrate` | Crea el esquema, las funciones de la regla de circunscripción, la tabla `registro_eleccion` y las vistas materializadas vacías (`WITH NO DATA`). Es idempotente. |
| `pnpm db:refresh` | Comprueba que la fuente tiene filas y que nadie la está recargando, y recalcula todas las vistas desde la fuente con `ANALYZE`, **en una sola transacción**. Tarda unos minutos. |
| `pnpm db:verify` | Ejecuta los controles de calidad. Termina con código 1 si alguna fila tiene `control = FALLA`. |

`scripts/db.mjs` divide cada archivo SQL en pasos con la marca `-- @paso: descripción` y muestra la duración de cada uno. Con Ctrl+C cancela la consulta en curso en el servidor.

Si `DATABASE_CA_CERT` tiene el PEM de la CA, el runner verifica el certificado del servidor (igual que la app). En ese caso `DATABASE_URL` debe usar el endpoint DNS de RDS y no la IP.

### Refresh atómico

`db:refresh` abre una transacción (`BEGIN`), ejecuta todos los pasos y confirma al final (`COMMIT`). Si un paso falla o se interrumpe, hace `ROLLBACK` y las vistas conservan los datos anteriores. Consecuencias:

- La API nunca ve una mezcla de vistas nuevas y viejas.
- Cada `REFRESH` (sin `CONCURRENTLY`) bloquea su vista hasta el `COMMIT`. Mientras dura el refresh, las consultas de la API esperan y pueden fallar por el `statement_timeout` de 15 s. Por eso conviene ejecutarlo en una ventana de bajo tráfico.
- Los archivos anteriores de todas las vistas se liberan al confirmar. Durante el refresh se necesita espacio libre adicional similar al tamaño del esquema (unos 1,2 GB).

El primer paso del refresh aborta (sin tocar las vistas) si `data_reporte.data_electoral_analitica` está vacía o si otra sesión tiene sobre ella un bloqueo de escritura (`TRUNCATE`, `INSERT`, `UPDATE` o `DELETE`, visto en `pg_locks`). Así, un refresh lanzado a mitad de una recarga no deja las vistas vacías o incompletas. `db:verify` también detecta vistas vacías.

## Objetos

| Objeto | Tipo | Llave única | Contenido |
|---|---|---|---|
| `circunscripcion(corporacion)`, `largo_circunscripcion(corporacion)`, `nombre_normalizado(nombre)`, `clave_candidato(desambiguacion, divipole, nombre)` | funciones | — | Regla de circunscripción y cálculo de `clave` (SQL `IMMUTABLE`, se expanden en línea) |
| `nombre_frecuencia` | vista | — | Auxiliar: variantes de nombre por código y territorio de la circunscripción (`''`, departamento o municipio), con su frecuencia |
| `registro_eleccion` | tabla | `id`, `(tipificacion, corporacion, periodo)` | Id permanente (`smallint` identity) de cada elección vista alguna vez en la fuente |
| `eleccion` | vista | `id` | Elecciones presentes hoy en la fuente, con su id de `registro_eleccion` |
| `candidato_codigo` | vista | `(eleccion_id, cod_partido, cod_candidato)` | Auxiliar: `circunscripcion`, `nombres` (normalizados distintos) y `desambiguacion` de cada código |
| `partido` | vista | `(eleccion_id, cod_partido)` | Nombre más frecuente del partido |
| `candidato` | vista | `(eleccion_id, cod_partido, cod_candidato, clave)` | Nombre más frecuente del candidato dentro de su clave y nombre de su partido |
| `votos_puesto` / `votos_zona` / `votos_municipio` / `votos_departamento` | vistas | `(eleccion_id, padre, ambito, cod_partido, cod_candidato, clave)` | Votos por unidad; `padre` es el código del nivel superior (`''` para departamentos) |
| `geografia` | vista | `codigo` | `nivel`, `padre` y `nombre` de cada unidad con votos |

## Reglas

- **Id de elección:** el refresh inserta en `registro_eleccion` solo las elecciones nuevas, en orden `(tipificacion, corporacion, periodo)`, antes de recalcular `eleccion`. Así, cargar una elección nueva (p. ej. CONGRESO 2026) no cambia los ids existentes: 1 = CÁMARA 2014 … 12 = PRESIDENCIA 2.ª vuelta 2026, y 13–17 = TERRITORIALES 2023 (ALCALDE, ASAMBLEA, CONCEJO, GOBERNADOR, JAL). **No se deben borrar filas de esta tabla.** Si se reconstruye el esquema desde cero, los ids se reasignan en ese mismo orden.
- **Circunscripción** (`ojo_aguila.circunscripcion`, refleja `src/domain/votos.ts`; hay que cambiar ambas a la vez):

  | Circunscripción | Corporaciones |
  |---|---|
  | nacional | PRIMERA VUELTA, SEGUNDA VUELTA, SENADO y cualquier corporación desconocida |
  | departamento | CAMARA, ASAMBLEA, GOBERNADOR |
  | municipio | ALCALDE, CONCEJO, JAL |

- **clave:** vale `'00'` por defecto. Solo cuando un código `(cod_partido, cod_candidato)` trae más de un nombre normalizado (mayúsculas, sin espacios ni tildes) en la elección, la clave separa a los candidatos según la circunscripción (`candidato_codigo.desambiguacion` + `clave_candidato`):
  - departamento → código del departamento (`05`);
  - ALCALDE y CONCEJO → código del municipio (`05001`);
  - JAL → municipio, `:` y los 6 primeros hexadecimales del `md5` del nombre normalizado (`05001:3fa2c9`). La circunscripción real de JAL es la comuna o localidad, que la fuente no trae; dentro del municipio el nombre separa a los candidatos (una variante de escritura del mismo candidato en el mismo municipio queda como otro id);
  - nacional → `'00'`: los nombres distintos son variantes de escritura del mismo candidato.

  La regla no aplica a la lista (`00000`) ni a los votos especiales. La API valida el id `partido-candidato-clave` con `PATRON_ID_CANDIDATO` (`src/domain/votos.ts`); si cambia el formato de la clave, hay que actualizar ese patrón. `db:verify` comprueba que en las circunscripciones departamental y municipal cada id tenga un solo nombre, y que el formato y el prefijo geográfico de cada clave sean coherentes con el municipio del voto.
- **Nombre por clave:** `nombre_frecuencia` agrupa por el territorio de la circunscripción (`''`, 2 o 5 caracteres), así que el nombre de cada clave es el más frecuente dentro de su propio grupo. Al tener la granularidad mínima, la vista es más pequeña que con departamento fijo (unas 154 000 filas).
- **Votos especiales:** `00996` VOTOS EN BLANCO, `00997` VOTOS NULOS y `00998` VOTOS NO MARCADOS usan nombres canónicos. `00000` es el voto solo por la lista y lleva el nombre del partido.
- **Nombres de departamento:** `geografia` usa el nombre oficial con tildes, en MAYÚSCULAS (`BOGOTÁ D.C.`, `ATLÁNTICO`, `NORTE DE SANTANDER`…), definido en la migración (CTE `departamento_oficial`). Los municipios conservan el nombre más frecuente de la fuente, salvo los del CTE `municipio_oficial` (hoy solo `16001`, que en la fuente llega como `BOGOTA. D.C.`). Los puestos siempre usan el nombre de la fuente. El código `18` no tiene nombre en la fuente (2 votos en CÁMARA 2014) y queda como `DEPARTAMENTO 18`.
- **Códigos de puesto alfanuméricos:** algunos puestos terminan en dos caracteres `[0-9A-Z]` (p. ej. `0100199A1`). Son 201, sobre todo en Nariño, Bogotá D.C. y Antioquia. Los niveles departamento, municipio y zona son siempre numéricos.
- **Exclusiones:** se excluye el departamento `00` (divipole `000000000`, sin votos). Las vistas de votos solo guardan combinaciones con votos > 0, por lo que los registros `TERRITORIAL` en cero no aparecen.
- **Collation:** los códigos usan `COLLATE "C"`; los nombres usan la collation por defecto de la base.

## Después de recargar la fuente

La fuente se recarga con `data_reporte.pb_actualizar_data_election()` (TRUNCATE + INSERT). Mientras corre, la tabla queda vacía para las demás sesiones o bloqueada. Hay que esperar a que termine y luego ejecutar:

```sh
pnpm db:refresh && pnpm db:verify
```

La recarga del 2026-09-15 corrigió la duplicidad ×2 de PRESIDENCIA (el paso (e) de `db:verify` ya no la reporta) y agregó TERRITORIALES 2023.

Para cambiar la definición de una vista, se elimina la vista (junto con sus dependientes) y se vuelven a ejecutar `db:migrate` y `db:refresh`. `registro_eleccion` no se debe eliminar: conserva los ids. Por ejemplo, para reconstruir las vistas que dependen de la clave (arrastra también `eleccion`, `partido`, `votos_zona`, `votos_municipio`, `votos_departamento` y `geografia`):

```sql
DROP MATERIALIZED VIEW IF EXISTS ojo_aguila.nombre_frecuencia, ojo_aguila.candidato_codigo,
  ojo_aguila.candidato, ojo_aguila.votos_puesto CASCADE;
```

Antes del `DROP` hay que confirmar que la fuente tiene filas y que no se está recargando (el `DROP` no pasa por el control del refresh). Mientras las vistas no existan o estén vacías, la API responde con error.

Las funciones se actualizan con `db:migrate` (`CREATE OR REPLACE`), pero las vistas conservan los datos calculados con la versión anterior hasta el siguiente `db:refresh`. Si cambia la firma de una función, hay que eliminarla con `DROP FUNCTION ... CASCADE`.
