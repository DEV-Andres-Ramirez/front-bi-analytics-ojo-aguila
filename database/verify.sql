-- =====================================================================
-- OJO DE ÁGUILA — Controles de calidad del esquema ojo_aguila.
--
-- Ejecutar con `pnpm db:verify` después de `pnpm db:refresh`.
-- Las consultas con columna `control` marcan cada fila como OK o FALLA;
-- el runner termina con código distinto de 0 si alguna fila falla.
-- =====================================================================

-- @paso: Estado de las vistas materializadas
SELECT matviewname AS vista,
       CASE WHEN ispopulated THEN 'OK' ELSE 'FALLA' END AS control,
       CASE WHEN ispopulated THEN 'con datos' ELSE 'sin datos: ejecutar pnpm db:refresh' END AS estado
  FROM pg_matviews
 WHERE schemaname = 'ojo_aguila'
 ORDER BY matviewname;

-- @paso: (a) Elecciones cargadas (un refresh sobre la fuente vacía deja las vistas vacías)
SELECT (SELECT count(*) FROM ojo_aguila.eleccion) AS elecciones,
       (SELECT count(*) FROM ojo_aguila.registro_eleccion) AS ids_registrados,
       EXISTS (SELECT 1 FROM data_reporte.data_electoral_analitica) AS fuente_con_filas,
       CASE WHEN EXISTS (SELECT 1 FROM ojo_aguila.eleccion) THEN 'OK' ELSE 'FALLA' END AS control;

-- @paso: (a) Votos por elección: fuente vs vistas de votos
WITH fuente AS (
  SELECT tipificacion, nombre_corporacion AS corporacion, periodo, sum(total_votos)::bigint AS votos
    FROM data_reporte.data_electoral_analitica
   GROUP BY 1, 2, 3
),
vistas AS (
  SELECT eleccion_id, 'puesto' AS nivel, sum(votos) AS votos FROM ojo_aguila.votos_puesto GROUP BY 1
  UNION ALL
  SELECT eleccion_id, 'zona', sum(votos) FROM ojo_aguila.votos_zona GROUP BY 1
  UNION ALL
  SELECT eleccion_id, 'municipio', sum(votos) FROM ojo_aguila.votos_municipio GROUP BY 1
  UNION ALL
  SELECT eleccion_id, 'departamento', sum(votos) FROM ojo_aguila.votos_departamento GROUP BY 1
),
pivote AS (
  SELECT eleccion_id,
         sum(votos) FILTER (WHERE nivel = 'puesto') AS puesto,
         sum(votos) FILTER (WHERE nivel = 'zona') AS zona,
         sum(votos) FILTER (WHERE nivel = 'municipio') AS municipio,
         sum(votos) FILTER (WHERE nivel = 'departamento') AS departamento
    FROM vistas
   GROUP BY 1
)
SELECT e.id,
       f.tipificacion,
       f.corporacion,
       f.periodo,
       f.votos AS fuente,
       p.puesto,
       p.zona,
       p.municipio,
       p.departamento,
       CASE WHEN f.votos = p.puesto AND p.puesto = p.zona AND p.zona = p.municipio AND p.municipio = p.departamento
            THEN 'OK' ELSE 'FALLA' END AS control
  FROM fuente AS f
  LEFT JOIN ojo_aguila.eleccion AS e USING (tipificacion, corporacion, periodo)
  LEFT JOIN pivote AS p ON p.eleccion_id = e.id
 ORDER BY f.tipificacion, f.corporacion, f.periodo;

-- @paso: (b) Filas por vista
SELECT 'nombre_frecuencia' AS vista, count(*) AS filas FROM ojo_aguila.nombre_frecuencia
UNION ALL SELECT 'registro_eleccion', count(*) FROM ojo_aguila.registro_eleccion
UNION ALL SELECT 'eleccion', count(*) FROM ojo_aguila.eleccion
UNION ALL SELECT 'candidato_codigo', count(*) FROM ojo_aguila.candidato_codigo
UNION ALL SELECT 'partido', count(*) FROM ojo_aguila.partido
UNION ALL SELECT 'candidato', count(*) FROM ojo_aguila.candidato
UNION ALL SELECT 'votos_puesto', count(*) FROM ojo_aguila.votos_puesto
UNION ALL SELECT 'votos_zona', count(*) FROM ojo_aguila.votos_zona
UNION ALL SELECT 'votos_municipio', count(*) FROM ojo_aguila.votos_municipio
UNION ALL SELECT 'votos_departamento', count(*) FROM ojo_aguila.votos_departamento
UNION ALL SELECT 'geografia (' || nivel || ')', count(*) FROM ojo_aguila.geografia GROUP BY nivel;

-- @paso: (b) Filas por elección
WITH candidatos AS (
  SELECT eleccion_id,
         count(*) AS candidatos,
         count(*) FILTER (WHERE clave <> '00') AS candidatos_desambiguados
    FROM ojo_aguila.candidato
   GROUP BY 1
),
partidos AS (
  SELECT eleccion_id, count(*) AS partidos FROM ojo_aguila.partido GROUP BY 1
),
votos AS (
  SELECT eleccion_id, 'puesto' AS nivel, count(*) AS filas FROM ojo_aguila.votos_puesto GROUP BY 1
  UNION ALL SELECT eleccion_id, 'zona', count(*) FROM ojo_aguila.votos_zona GROUP BY 1
  UNION ALL SELECT eleccion_id, 'municipio', count(*) FROM ojo_aguila.votos_municipio GROUP BY 1
  UNION ALL SELECT eleccion_id, 'departamento', count(*) FROM ojo_aguila.votos_departamento GROUP BY 1
)
SELECT e.id,
       e.tipificacion,
       e.corporacion,
       e.periodo,
       p.partidos,
       c.candidatos,
       c.candidatos_desambiguados,
       sum(v.filas) FILTER (WHERE v.nivel = 'puesto') AS filas_puesto,
       sum(v.filas) FILTER (WHERE v.nivel = 'zona') AS filas_zona,
       sum(v.filas) FILTER (WHERE v.nivel = 'municipio') AS filas_municipio,
       sum(v.filas) FILTER (WHERE v.nivel = 'departamento') AS filas_departamento
  FROM ojo_aguila.eleccion AS e
  LEFT JOIN candidatos AS c ON c.eleccion_id = e.id
  LEFT JOIN partidos AS p ON p.eleccion_id = e.id
  LEFT JOIN votos AS v ON v.eleccion_id = e.id
 GROUP BY e.id, e.tipificacion, e.corporacion, e.periodo, p.partidos, c.candidatos, c.candidatos_desambiguados
 ORDER BY e.id;

-- @paso: (c) Códigos de las vistas de votos sin unidad en geografia
WITH codigos AS (
  SELECT DISTINCT 'puesto' AS nivel, ambito AS codigo, padre FROM ojo_aguila.votos_puesto
  UNION ALL
  SELECT DISTINCT 'zona', ambito, padre FROM ojo_aguila.votos_zona
  UNION ALL
  SELECT DISTINCT 'municipio', ambito, padre FROM ojo_aguila.votos_municipio
  UNION ALL
  SELECT DISTINCT 'departamento', ambito, padre FROM ojo_aguila.votos_departamento
)
SELECT c.nivel,
       count(*) AS codigos,
       count(*) FILTER (WHERE g.codigo IS NULL) AS sin_geografia,
       count(*) FILTER (WHERE g.codigo IS NOT NULL AND (g.nivel <> c.nivel OR g.padre <> c.padre)) AS nivel_o_padre_distinto,
       CASE WHEN count(*) FILTER (WHERE g.codigo IS NULL OR g.nivel <> c.nivel OR g.padre <> c.padre) = 0
            THEN 'OK' ELSE 'FALLA' END AS control
  FROM codigos AS c
  LEFT JOIN ojo_aguila.geografia AS g ON g.codigo = c.codigo
 GROUP BY c.nivel
 ORDER BY min(length(c.codigo));

-- @paso: (c) Integridad de geografia
WITH niveles (nivel, largo) AS (
  VALUES ('departamento', 2), ('municipio', 5), ('zona', 7), ('puesto', 9)
),
revision AS (
  SELECT count(*) AS unidades,
         count(*) FILTER (WHERE n.nivel IS NULL) AS nivel_invalido,
         count(*) FILTER (WHERE length(g.codigo) <> n.largo) AS largo_invalido,
         count(*) FILTER (WHERE g.padre <> '' AND p.codigo IS NULL) AS padre_inexistente,
         count(*) FILTER (WHERE nullif(btrim(g.nombre), '') IS NULL) AS sin_nombre,
         count(*) FILTER (WHERE g.codigo LIKE '00%') AS departamento_00
    FROM ojo_aguila.geografia AS g
    LEFT JOIN niveles AS n ON n.nivel = g.nivel
    LEFT JOIN ojo_aguila.geografia AS p ON p.codigo = g.padre
)
SELECT *,
       CASE WHEN nivel_invalido + largo_invalido + padre_inexistente + sin_nombre + departamento_00 = 0
            THEN 'OK' ELSE 'FALLA' END AS control
  FROM revision;

-- @paso: (d) Candidatos y partidos sin nombre
WITH claves AS (
  SELECT DISTINCT eleccion_id, cod_partido, cod_candidato, clave FROM ojo_aguila.votos_puesto
),
revision AS (
  SELECT k.eleccion_id,
         count(*) AS claves_con_votos,
         count(*) FILTER (WHERE c.eleccion_id IS NULL) AS sin_candidato,
         count(*) FILTER (WHERE c.eleccion_id IS NOT NULL AND nullif(btrim(c.nombre_candidato), '') IS NULL) AS sin_nombre_candidato,
         count(*) FILTER (WHERE c.eleccion_id IS NOT NULL AND nullif(btrim(c.nombre_partido), '') IS NULL) AS sin_nombre_partido
    FROM claves AS k
    LEFT JOIN ojo_aguila.candidato AS c USING (eleccion_id, cod_partido, cod_candidato, clave)
   GROUP BY k.eleccion_id
)
SELECT e.id,
       e.tipificacion,
       e.corporacion,
       e.periodo,
       r.claves_con_votos,
       r.sin_candidato,
       r.sin_nombre_candidato,
       r.sin_nombre_partido,
       CASE WHEN r.sin_candidato + r.sin_nombre_candidato + r.sin_nombre_partido = 0 THEN 'OK' ELSE 'FALLA' END AS control
  FROM revision AS r
  JOIN ojo_aguila.eleccion AS e ON e.id = r.eleccion_id
 ORDER BY e.id;

-- @paso: (d) Una persona por id de candidato
-- Recalcula la clave de cada variante de nombre (nombre_frecuencia) y cuenta los
-- nombres normalizados distintos por id (partido, candidato, clave). En las
-- circunscripciones departamental y municipal cada id debe corresponder a un solo
-- nombre: si no, dos personas comparten id (FALLA). En la nacional los nombres
-- distintos de un código son variantes de escritura del mismo candidato
-- (informativo). También exige que cada id exista en la vista candidato.
WITH variantes AS (
  SELECT c.eleccion_id,
         c.circunscripcion,
         n.cod_partido,
         n.cod_candidato,
         ojo_aguila.clave_candidato(c.desambiguacion, n.territorio, n.nombre_candidato) COLLATE "C" AS clave,
         ojo_aguila.nombre_normalizado(n.nombre_candidato) AS nombre
    FROM ojo_aguila.nombre_frecuencia AS n
    JOIN ojo_aguila.eleccion AS e USING (tipificacion, corporacion, periodo)
    JOIN ojo_aguila.candidato_codigo AS c
      ON c.eleccion_id = e.id AND c.cod_partido = n.cod_partido AND c.cod_candidato = n.cod_candidato
   WHERE n.cod_candidato NOT IN ('00000', '00996', '00997', '00998')
),
ids AS (
  SELECT eleccion_id, circunscripcion, cod_partido, cod_candidato, clave, count(DISTINCT nombre) AS nombres
    FROM variantes
   GROUP BY 1, 2, 3, 4, 5
),
revision AS (
  SELECT i.eleccion_id,
         i.circunscripcion,
         count(*) AS ids,
         count(*) FILTER (WHERE i.clave <> '00') AS ids_desambiguados,
         count(*) FILTER (WHERE i.nombres > 1) AS ids_con_varios_nombres,
         count(*) FILTER (WHERE k.eleccion_id IS NULL) AS sin_candidato
    FROM ids AS i
    LEFT JOIN ojo_aguila.candidato AS k USING (eleccion_id, cod_partido, cod_candidato, clave)
   GROUP BY 1, 2
)
SELECT e.id,
       e.corporacion,
       e.periodo,
       r.circunscripcion,
       r.ids,
       r.ids_desambiguados,
       r.ids_con_varios_nombres,
       r.sin_candidato,
       CASE
         WHEN r.sin_candidato > 0 THEN 'FALLA'
         WHEN r.ids_con_varios_nombres = 0 THEN 'OK'
         WHEN r.circunscripcion = 'nacional' THEN 'OK'
         ELSE 'FALLA'
       END AS control,
       CASE
         WHEN r.sin_candidato > 0 THEN 'ids sin fila en candidato'
         WHEN r.ids_con_varios_nombres = 0 THEN 'un nombre por id'
         WHEN r.circunscripcion = 'nacional' THEN 'variantes de escritura (circunscripción nacional)'
         ELSE 'personas distintas bajo un mismo id'
       END AS diagnostico
  FROM revision AS r
  JOIN ojo_aguila.eleccion AS e ON e.id = r.eleccion_id
 ORDER BY e.id;

-- @paso: (d) Formato y territorio de la clave en las vistas de votos
-- La clave debe tener un formato que acepte la API (PATRON_ID_CANDIDATO en
-- src/domain/votos.ts) y, si no es '00', su prefijo geográfico debe contener al
-- municipio donde está el voto. votos_municipio tiene todas las claves.
WITH revision AS (
  SELECT m.eleccion_id,
         count(DISTINCT m.clave) AS claves,
         count(DISTINCT m.clave) FILTER (WHERE m.clave !~ '^([0-9]{2}|[0-9]{5}(:[0-9a-f]{6})?)$') AS formato_invalido,
         count(*) FILTER (
           WHERE m.clave <> '00' AND left(m.ambito, length(split_part(m.clave, ':', 1))) <> split_part(m.clave, ':', 1)
         ) AS fuera_de_su_territorio,
         count(*) FILTER (
           WHERE m.clave <> '00'
             AND length(split_part(m.clave, ':', 1)) <> ojo_aguila.largo_circunscripcion(e.corporacion)
         ) AS largo_distinto_a_circunscripcion
    FROM ojo_aguila.votos_municipio AS m
    JOIN ojo_aguila.eleccion AS e ON e.id = m.eleccion_id
   GROUP BY m.eleccion_id
)
SELECT e.id,
       e.corporacion,
       e.periodo,
       r.claves,
       r.formato_invalido,
       r.fuera_de_su_territorio,
       r.largo_distinto_a_circunscripcion,
       CASE WHEN r.formato_invalido + r.fuera_de_su_territorio + r.largo_distinto_a_circunscripcion = 0
            THEN 'OK' ELSE 'FALLA' END AS control
  FROM revision AS r
  JOIN ojo_aguila.eleccion AS e ON e.id = r.eleccion_id
 ORDER BY e.id;

-- @paso: (e) Duplicidad de PRESIDENCIA (informativo, muestra Bogotá D.C.)
-- Sin número de mesa no hay llave natural. Indicio: si todas las combinaciones
-- (divipole, partido, candidato, votos) aparecen un número par de veces y ninguna
-- una sola vez, la elección viene duplicada. Congreso sirve de referencia (~50 % únicas).
WITH grupos AS (
  SELECT tipificacion, nombre_corporacion AS corporacion, periodo, count(*) AS repeticiones
    FROM data_reporte.data_electoral_analitica
   WHERE divipole >= '16' AND divipole < '17'
   GROUP BY tipificacion, nombre_corporacion, periodo, divipole, codigo_partido, codigo_candidato, total_votos
),
indicio AS (
  SELECT tipificacion,
         corporacion,
         periodo,
         count(*) AS combinaciones,
         round(100.0 * count(*) FILTER (WHERE repeticiones % 2 = 0) / count(*), 1) AS pct_pares,
         round(100.0 * count(*) FILTER (WHERE repeticiones = 1) / count(*), 1) AS pct_unicas,
         count(*) FILTER (WHERE repeticiones % 2 = 1) = 0 AS todas_pares
    FROM grupos
   GROUP BY 1, 2, 3
),
totales AS (
  SELECT eleccion_id, sum(votos)::bigint AS votos FROM ojo_aguila.votos_departamento GROUP BY 1
)
SELECT i.tipificacion,
       i.corporacion,
       i.periodo,
       i.combinaciones,
       i.pct_pares,
       i.pct_unicas,
       t.votos AS votos_totales,
       CASE WHEN i.todas_pares THEN t.votos / 2 END AS votos_si_se_deduplica,
       CASE WHEN i.todas_pares THEN 'DUPLICADA ×2: pendiente de corrección en la fuente' ELSE 'sin indicio' END AS diagnostico
  FROM indicio AS i
  JOIN ojo_aguila.eleccion AS e USING (tipificacion, corporacion, periodo)
  LEFT JOIN totales AS t ON t.eleccion_id = e.id
 ORDER BY e.id;

-- @paso: (f) Tamaño de los objetos
WITH objetos AS (
  SELECT c.relname AS vista,
         c.reltuples::bigint AS filas_estimadas,
         pg_relation_size(c.oid) AS datos,
         pg_indexes_size(c.oid) AS indices,
         pg_total_relation_size(c.oid) AS total
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
   WHERE n.nspname = 'ojo_aguila' AND c.relkind IN ('m', 'r')
)
SELECT vista, filas_estimadas, pg_size_pretty(datos) AS datos, pg_size_pretty(indices) AS indices, pg_size_pretty(total) AS total
  FROM (
    SELECT vista, filas_estimadas, datos, indices, total, 0 AS grupo FROM objetos
    UNION ALL
    SELECT 'TOTAL', sum(filas_estimadas)::bigint, sum(datos)::bigint, sum(indices)::bigint, sum(total)::bigint, 1 FROM objetos
  ) AS t
 ORDER BY t.grupo, t.total DESC;
