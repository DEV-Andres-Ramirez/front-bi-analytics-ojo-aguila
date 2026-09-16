-- =====================================================================
-- OJO DE ÁGUILA — 001: esquema ojo_aguila (vistas materializadas)
--
-- Capa de lectura precalculada sobre data_reporte (que NO se modifica).
-- Idempotente: todo se crea con IF NOT EXISTS (las vistas, WITH NO DATA) o
-- CREATE OR REPLACE (las funciones); los datos se cargan con
-- `pnpm db:refresh` (database/refresh.sql).
--
-- Dependencias (orden de creación y de refresh):
--   funciones (circunscripcion, largo_circunscripcion, nombre_normalizado,
--   clave_candidato) → nombre_frecuencia → registro_eleccion → eleccion
--   → candidato_codigo → partido → candidato → votos_puesto → votos_zona
--   → votos_municipio → votos_departamento → geografia
--
-- Convenciones:
--   * Los códigos (padre, ambito, cod_*, clave, codigo, territorio) usan
--     COLLATE "C": comparaciones binarias, índices más rápidos y orden
--     estable. Los nombres usan la collation por defecto de la base (en la
--     fuente vienen en "C"), para que upper() y ORDER BY traten bien tildes y
--     eñes.
--   * Se excluye el departamento '00' (divipole 000000000: filas sin votos).
--   * Las vistas de votos solo guardan combinaciones con votos > 0 y se
--     ordenan físicamente por (eleccion_id, padre, ambito) para que la
--     consulta de hijos lea pocas páginas.
--   * Para modificar una vista: DROP de la vista (y dependientes) y volver a
--     ejecutar esta migración; IF NOT EXISTS no reemplaza. Las funciones usan
--     CREATE OR REPLACE: un cambio de cuerpo se aplica al migrar, pero las
--     vistas conservan sus datos hasta el siguiente refresh; un cambio de
--     firma exige DROP FUNCTION ... CASCADE.
-- =====================================================================

-- @paso: Esquema ojo_aguila
CREATE SCHEMA IF NOT EXISTS ojo_aguila;

COMMENT ON SCHEMA ojo_aguila IS
  'OJO DE ÁGUILA: vistas materializadas de resultados electorales derivadas de data_reporte. Se recalculan con pnpm db:refresh.';

-- @paso: Funciones de circunscripción y clave de candidato
-- Regla de circunscripción por corporación. Refleja REGLAS_CORPORACION de
-- src/domain/votos.ts: si se agrega o cambia una corporación, hay que
-- actualizar ambas y reconstruir las vistas (ver database/README.md).
-- Las funciones son SQL simples, IMMUTABLE y PARALLEL SAFE: el planificador las
-- expande en línea y los REFRESH conservan el plan paralelo.
CREATE OR REPLACE FUNCTION ojo_aguila.circunscripcion(corporacion text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE
           WHEN corporacion IN ('CAMARA', 'ASAMBLEA', 'GOBERNADOR') THEN 'departamento'
           WHEN corporacion IN ('ALCALDE', 'CONCEJO', 'JAL') THEN 'municipio'
           ELSE 'nacional'
         END
$$;

COMMENT ON FUNCTION ojo_aguila.circunscripcion(text) IS
  'Circunscripción de una corporación: departamento (CAMARA, ASAMBLEA, GOBERNADOR), municipio (ALCALDE, CONCEJO, JAL) o nacional (PRIMERA VUELTA, SEGUNDA VUELTA, SENADO y cualquier corporación desconocida). Refleja src/domain/votos.ts.';

CREATE OR REPLACE FUNCTION ojo_aguila.largo_circunscripcion(corporacion text)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE ojo_aguila.circunscripcion(corporacion)
           WHEN 'departamento' THEN 2
           WHEN 'municipio' THEN 5
           ELSE 0
         END
$$;

COMMENT ON FUNCTION ojo_aguila.largo_circunscripcion(text) IS
  'Largo del prefijo divipole del territorio de la circunscripción: 0 nacional, 2 departamento, 5 municipio.';

-- Con la collation "default", upper() también convierte las letras con tilde (en
-- "C", la de los nombres de la fuente, solo convierte ASCII). Quitar todos los
-- espacios hace que el resultado sea igual sobre el nombre crudo de la fuente
-- (votos_puesto) que sobre el nombre limpio de nombre_frecuencia (candidato).
CREATE OR REPLACE FUNCTION ojo_aguila.nombre_normalizado(nombre text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT nullif(
           translate(upper(regexp_replace(nombre COLLATE "default", '\s+', '', 'g')), 'ÁÉÍÓÚÜÑÀÈÌÒÙ', 'AEIOUUNAEIOU'),
           ''
         )
$$;

COMMENT ON FUNCTION ojo_aguila.nombre_normalizado(text) IS
  'Nombre para comparar variantes: mayúsculas, sin espacios y sin tildes (Ñ → N); NULL si queda vacío.';

-- Única definición de la columna clave (vistas candidato y votos_puesto).
CREATE OR REPLACE FUNCTION ojo_aguila.clave_candidato(desambiguacion text, divipole text, nombre_candidato text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE desambiguacion
           WHEN 'departamento' THEN left(divipole, 2)
           WHEN 'municipio' THEN left(divipole, 5)
           WHEN 'municipio_nombre' THEN
             left(divipole, 5) || ':' || left(md5(coalesce(ojo_aguila.nombre_normalizado(nombre_candidato), '')), 6)
           ELSE '00'
         END
$$;

COMMENT ON FUNCTION ojo_aguila.clave_candidato(text, text, text) IS
  'clave según candidato_codigo.desambiguacion: departamento → left(divipole, 2); municipio → left(divipole, 5); municipio_nombre (JAL) → left(divipole, 5) || '':'' || 6 hex del md5 del nombre normalizado; ninguna o NULL → ''00''. divipole puede ser un prefijo (territorio) con el largo suficiente.';

-- @paso: Vista auxiliar nombre_frecuencia
-- Granularidad: territorio de la circunscripción ('' nacional, departamento o
-- municipio), la mínima que necesita la clave. Así el nombre de cada clave se
-- elige dentro de su propio grupo sin multiplicar por municipio las filas de
-- las corporaciones nacionales y departamentales.
CREATE MATERIALIZED VIEW IF NOT EXISTS ojo_aguila.nombre_frecuencia AS
WITH variantes AS (
  SELECT tipificacion,
         nombre_corporacion AS corporacion,
         periodo,
         left(divipole, ojo_aguila.largo_circunscripcion(nombre_corporacion)) AS territorio,
         coalesce(codigo_partido, '') AS cod_partido,
         coalesce(codigo_candidato, '') AS cod_candidato,
         nombre_partido,
         nombre_candidato,
         count(*) AS filas
    FROM data_reporte.data_electoral_analitica
   WHERE left(divipole, 2) <> '00'
   GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
)
SELECT tipificacion,
       corporacion,
       periodo,
       territorio COLLATE "C" AS territorio,
       cod_partido COLLATE "C" AS cod_partido,
       cod_candidato COLLATE "C" AS cod_candidato,
       nullif(regexp_replace(btrim(nombre_partido), '\s+', ' ', 'g'), '') COLLATE "default" AS nombre_partido,
       nullif(regexp_replace(btrim(nombre_candidato), '\s+', ' ', 'g'), '') COLLATE "default" AS nombre_candidato,
       sum(filas)::integer AS filas
  FROM variantes
 GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
WITH NO DATA;

COMMENT ON MATERIALIZED VIEW ojo_aguila.nombre_frecuencia IS
  'Auxiliar (uso interno). Variantes de nombre de partido/candidato por elección, territorio de la circunscripción y código, con su frecuencia en filas (mesas). Única lectura de la tabla base para nombres; alimenta eleccion, candidato_codigo, partido y candidato.';
COMMENT ON COLUMN ojo_aguila.nombre_frecuencia.territorio IS
  'Prefijo divipole de largo ojo_aguila.largo_circunscripcion(corporacion): vacío en corporaciones nacionales, departamento (2) o municipio (5).';
COMMENT ON COLUMN ojo_aguila.nombre_frecuencia.nombre_partido IS 'Nombre sin espacios sobrantes; NULL si viene vacío.';
COMMENT ON COLUMN ojo_aguila.nombre_frecuencia.nombre_candidato IS 'Nombre sin espacios sobrantes; NULL si viene vacío.';
COMMENT ON COLUMN ojo_aguila.nombre_frecuencia.filas IS 'Filas de la fuente (mesas) que traen esta variante.';

-- @paso: Tabla registro_eleccion
CREATE TABLE IF NOT EXISTS ojo_aguila.registro_eleccion (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipificacion text NOT NULL,
  corporacion text NOT NULL,
  periodo text NOT NULL,
  CONSTRAINT registro_eleccion_filtros_uq UNIQUE (tipificacion, corporacion, periodo)
);

COMMENT ON TABLE ojo_aguila.registro_eleccion IS
  'Id permanente de cada elección vista alguna vez en la fuente. El refresh solo inserta las nuevas, en orden (tipificacion, corporacion, periodo): cargar una elección no cambia los ids existentes. No borrar filas: las vistas de votos se llaman por este id.';

-- @paso: Vista eleccion
CREATE MATERIALIZED VIEW IF NOT EXISTS ojo_aguila.eleccion AS
SELECT r.id,
       r.tipificacion,
       r.corporacion,
       r.periodo
  FROM ojo_aguila.registro_eleccion AS r
 WHERE EXISTS (
         SELECT 1
           FROM ojo_aguila.nombre_frecuencia AS n
          WHERE n.tipificacion = r.tipificacion AND n.corporacion = r.corporacion AND n.periodo = r.periodo
       )
 ORDER BY r.id
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS eleccion_id_uidx ON ojo_aguila.eleccion (id);
CREATE UNIQUE INDEX IF NOT EXISTS eleccion_filtros_uidx ON ojo_aguila.eleccion (tipificacion, corporacion, periodo);

COMMENT ON MATERIALIZED VIEW ojo_aguila.eleccion IS
  'Elecciones disponibles en la fuente: una por (tipificacion, corporacion, periodo). Alimenta el catálogo de filtros del header.';
COMMENT ON COLUMN ojo_aguila.eleccion.id IS 'Id permanente tomado de registro_eleccion.';
COMMENT ON COLUMN ojo_aguila.eleccion.corporacion IS
  'nombre_corporacion de la fuente (PRIMERA VUELTA, SEGUNDA VUELTA, SENADO, CAMARA, ALCALDE, ASAMBLEA, CONCEJO, GOBERNADOR, JAL).';

-- @paso: Vista auxiliar candidato_codigo
CREATE MATERIALIZED VIEW IF NOT EXISTS ojo_aguila.candidato_codigo AS
WITH codigos AS (
  SELECT e.id AS eleccion_id,
         e.corporacion,
         n.cod_partido,
         n.cod_candidato,
         count(DISTINCT ojo_aguila.nombre_normalizado(n.nombre_candidato)) AS nombres
    FROM ojo_aguila.nombre_frecuencia AS n
    JOIN ojo_aguila.eleccion AS e USING (tipificacion, corporacion, periodo)
   GROUP BY e.id, e.corporacion, n.cod_partido, n.cod_candidato
)
SELECT eleccion_id,
       cod_partido,
       cod_candidato,
       ojo_aguila.circunscripcion(corporacion) AS circunscripcion,
       nombres::integer AS nombres,
       CASE
         WHEN cod_candidato IN ('00000', '00996', '00997', '00998') OR nombres <= 1 THEN 'ninguna'
         ELSE CASE ojo_aguila.circunscripcion(corporacion)
                WHEN 'departamento' THEN 'departamento'
                WHEN 'municipio' THEN CASE corporacion WHEN 'JAL' THEN 'municipio_nombre' ELSE 'municipio' END
                ELSE 'ninguna'
              END
       END AS desambiguacion
  FROM codigos
 ORDER BY 1, 2, 3
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS candidato_codigo_uidx ON ojo_aguila.candidato_codigo (eleccion_id, cod_partido, cod_candidato);

COMMENT ON MATERIALIZED VIEW ojo_aguila.candidato_codigo IS
  'Auxiliar (uso interno). Desambiguación de cada código (cod_partido, cod_candidato) dentro de su elección; con ojo_aguila.clave_candidato define la columna clave de candidato y de las vistas de votos.';
COMMENT ON COLUMN ojo_aguila.candidato_codigo.circunscripcion IS 'ojo_aguila.circunscripcion(corporacion): nacional, departamento o municipio.';
COMMENT ON COLUMN ojo_aguila.candidato_codigo.nombres IS 'Nombres normalizados distintos del código en la elección (ojo_aguila.nombre_normalizado).';
COMMENT ON COLUMN ojo_aguila.candidato_codigo.desambiguacion IS
  'ninguna (clave 00): un solo nombre normalizado, lista (00000), voto especial (00996-00998) o circunscripción nacional, donde los nombres distintos son variantes de escritura. Con más de un nombre: departamento (CAMARA, ASAMBLEA, GOBERNADOR), municipio (ALCALDE, CONCEJO) o municipio_nombre (JAL: la fuente no trae la comuna y el nombre separa a los candidatos dentro del municipio).';

-- @paso: Vista partido
CREATE MATERIALIZED VIEW IF NOT EXISTS ojo_aguila.partido AS
WITH variantes AS (
  SELECT e.id AS eleccion_id,
         n.cod_partido,
         n.nombre_partido AS nombre,
         sum(n.filas) AS filas
    FROM ojo_aguila.nombre_frecuencia AS n
    JOIN ojo_aguila.eleccion AS e USING (tipificacion, corporacion, periodo)
   GROUP BY 1, 2, 3
)
SELECT DISTINCT ON (eleccion_id, cod_partido)
       eleccion_id,
       cod_partido,
       CASE
         WHEN cod_partido = '00000' THEN 'SIN PARTIDO'
         ELSE coalesce(nombre, 'PARTIDO ' || cod_partido)
       END COLLATE "default" AS nombre_partido
  FROM variantes
 ORDER BY eleccion_id, cod_partido, nombre IS NULL, filas DESC, nombre
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS partido_uidx ON ojo_aguila.partido (eleccion_id, cod_partido);

COMMENT ON MATERIALIZED VIEW ojo_aguila.partido IS
  'Partidos por elección con su nombre más frecuente (ignora vacíos). 00000 agrupa votos especiales y se llama SIN PARTIDO; un código sin nombre en la fuente queda como PARTIDO <código>.';

-- @paso: Vista candidato
CREATE MATERIALIZED VIEW IF NOT EXISTS ojo_aguila.candidato AS
WITH variantes AS (
  SELECT e.id AS eleccion_id,
         n.cod_partido,
         n.cod_candidato,
         ojo_aguila.clave_candidato(c.desambiguacion, n.territorio, n.nombre_candidato) AS clave,
         n.nombre_candidato AS nombre,
         sum(n.filas) AS filas
    FROM ojo_aguila.nombre_frecuencia AS n
    JOIN ojo_aguila.eleccion AS e USING (tipificacion, corporacion, periodo)
    JOIN ojo_aguila.candidato_codigo AS c
      ON c.eleccion_id = e.id AND c.cod_partido = n.cod_partido AND c.cod_candidato = n.cod_candidato
   GROUP BY 1, 2, 3, 4, 5
),
frecuente AS (
  SELECT DISTINCT ON (eleccion_id, cod_partido, cod_candidato, clave)
         eleccion_id, cod_partido, cod_candidato, clave, nombre
    FROM variantes
   ORDER BY eleccion_id, cod_partido, cod_candidato, clave, nombre IS NULL, filas DESC, nombre
)
SELECT f.eleccion_id,
       f.cod_partido,
       f.cod_candidato,
       f.clave COLLATE "C" AS clave,
       CASE f.cod_candidato
         WHEN '00996' THEN 'VOTOS EN BLANCO'
         WHEN '00997' THEN 'VOTOS NULOS'
         WHEN '00998' THEN 'VOTOS NO MARCADOS'
         WHEN '00000' THEN p.nombre_partido
         ELSE coalesce(f.nombre, 'CANDIDATO ' || f.cod_candidato)
       END COLLATE "default" AS nombre_candidato,
       p.nombre_partido
  FROM frecuente AS f
  JOIN ojo_aguila.partido AS p USING (eleccion_id, cod_partido)
 ORDER BY 1, 2, 3, 4
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS candidato_uidx ON ojo_aguila.candidato (eleccion_id, cod_partido, cod_candidato, clave);

COMMENT ON MATERIALIZED VIEW ojo_aguila.candidato IS
  'Candidatos por elección con el nombre más frecuente dentro de su clave. Votos especiales con nombre canónico (00996 VOTOS EN BLANCO, 00997 VOTOS NULOS, 00998 VOTOS NO MARCADOS); 00000 = voto solo por la lista, con el nombre del partido (en la fuente llega truncado o con espacios intercalados).';
COMMENT ON COLUMN ojo_aguila.candidato.clave IS
  '''00'' por defecto. Si el código trae varios nombres en una elección departamental o municipal (candidato_codigo.desambiguacion): departamento (2 dígitos), municipio (5) o, en JAL, municipio:6 hex del nombre normalizado. Ver ojo_aguila.clave_candidato.';

-- @paso: Vista votos_puesto
-- Agrupa por la llave completa del índice en collation "C": el plan paralelo
-- ordena en los workers y entrega las filas ya en orden, sin reordenar al final.
CREATE MATERIALIZED VIEW IF NOT EXISTS ojo_aguila.votos_puesto AS
SELECT e.id AS eleccion_id,
       left(f.divipole, 7) COLLATE "C" AS padre,
       f.divipole COLLATE "C" AS ambito,
       coalesce(f.codigo_partido, '') COLLATE "C" AS cod_partido,
       coalesce(f.codigo_candidato, '') COLLATE "C" AS cod_candidato,
       ojo_aguila.clave_candidato(c.desambiguacion, f.divipole, f.nombre_candidato) COLLATE "C" AS clave,
       sum(f.total_votos)::integer AS votos
  FROM data_reporte.data_electoral_analitica AS f
  JOIN ojo_aguila.eleccion AS e
    ON e.tipificacion = f.tipificacion AND e.corporacion = f.nombre_corporacion AND e.periodo = f.periodo
  LEFT JOIN ojo_aguila.candidato_codigo AS c
    ON c.eleccion_id = e.id
   AND c.cod_partido = coalesce(f.codigo_partido, '')
   AND c.cod_candidato = coalesce(f.codigo_candidato, '')
 WHERE left(f.divipole, 2) <> '00'
 GROUP BY 1, 2, 3, 4, 5, 6
HAVING sum(f.total_votos) > 0
 ORDER BY 1, 2, 3, 4, 5, 6
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS votos_puesto_uidx
  ON ojo_aguila.votos_puesto (eleccion_id, padre, ambito, cod_partido, cod_candidato, clave);

COMMENT ON MATERIALIZED VIEW ojo_aguila.votos_puesto IS
  'Votos por puesto (colapsa las mesas de la fuente). ambito = divipole (9), padre = zona (7). Hijos de una zona: WHERE eleccion_id = $1 AND padre = $2.';

-- @paso: Vista votos_zona
CREATE MATERIALIZED VIEW IF NOT EXISTS ojo_aguila.votos_zona AS
SELECT p.eleccion_id,
       left(p.padre, 5) COLLATE "C" AS padre,
       p.padre AS ambito,
       p.cod_partido,
       p.cod_candidato,
       p.clave,
       sum(p.votos)::integer AS votos
  FROM ojo_aguila.votos_puesto AS p
 GROUP BY p.eleccion_id, p.padre, p.cod_partido, p.cod_candidato, p.clave
 ORDER BY 1, 2, 3
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS votos_zona_uidx
  ON ojo_aguila.votos_zona (eleccion_id, padre, ambito, cod_partido, cod_candidato, clave);

COMMENT ON MATERIALIZED VIEW ojo_aguila.votos_zona IS
  'Votos por zona, derivada de votos_puesto. ambito = zona (7), padre = municipio (5).';

-- @paso: Vista votos_municipio
CREATE MATERIALIZED VIEW IF NOT EXISTS ojo_aguila.votos_municipio AS
SELECT z.eleccion_id,
       left(z.padre, 2) COLLATE "C" AS padre,
       z.padre AS ambito,
       z.cod_partido,
       z.cod_candidato,
       z.clave,
       sum(z.votos)::integer AS votos
  FROM ojo_aguila.votos_zona AS z
 GROUP BY z.eleccion_id, z.padre, z.cod_partido, z.cod_candidato, z.clave
 ORDER BY 1, 2, 3
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS votos_municipio_uidx
  ON ojo_aguila.votos_municipio (eleccion_id, padre, ambito, cod_partido, cod_candidato, clave);

COMMENT ON MATERIALIZED VIEW ojo_aguila.votos_municipio IS
  'Votos por municipio, derivada de votos_zona. ambito = municipio (5), padre = departamento (2).';

-- @paso: Vista votos_departamento
CREATE MATERIALIZED VIEW IF NOT EXISTS ojo_aguila.votos_departamento AS
SELECT m.eleccion_id,
       CAST('' AS text) COLLATE "C" AS padre,
       m.padre AS ambito,
       m.cod_partido,
       m.cod_candidato,
       m.clave,
       sum(m.votos)::integer AS votos
  FROM ojo_aguila.votos_municipio AS m
 GROUP BY m.eleccion_id, m.padre, m.cod_partido, m.cod_candidato, m.clave
 ORDER BY 1, 3
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS votos_departamento_uidx
  ON ojo_aguila.votos_departamento (eleccion_id, padre, ambito, cod_partido, cod_candidato, clave);

COMMENT ON MATERIALIZED VIEW ojo_aguila.votos_departamento IS
  'Votos por departamento, derivada de votos_municipio. ambito = departamento (2), padre = '''' (Colombia). Hijos nacionales: WHERE eleccion_id = $1 AND padre = ''''.';

-- @paso: Vista geografia
CREATE MATERIALIZED VIEW IF NOT EXISTS ojo_aguila.geografia AS
WITH dim AS (
  SELECT divipole,
         nullif(regexp_replace(btrim(nombre_departamento), '\s+', ' ', 'g'), '') COLLATE "default" AS nombre_departamento,
         nullif(regexp_replace(btrim(nombre_municipio), '\s+', ' ', 'g'), '') COLLATE "default" AS nombre_municipio,
         nullif(regexp_replace(btrim(nombre_puesto), '\s+', ' ', 'g'), '') COLLATE "default" AS nombre_puesto
    FROM data_reporte.dim_divipole
   WHERE left(divipole, 2) <> '00'
),
-- La fuente trae los departamentos sin tildes y alguno truncado ('NORTE DE SAN').
departamento_oficial (codigo, nombre) AS (
  VALUES ('01', 'ANTIOQUIA'), ('03', 'ATLÁNTICO'), ('05', 'BOLÍVAR'), ('07', 'BOYACÁ'),
         ('09', 'CALDAS'), ('11', 'CAUCA'), ('12', 'CESAR'), ('13', 'CÓRDOBA'),
         ('15', 'CUNDINAMARCA'), ('16', 'BOGOTÁ D.C.'), ('17', 'CHOCÓ'), ('19', 'HUILA'),
         ('21', 'MAGDALENA'), ('23', 'NARIÑO'), ('24', 'RISARALDA'), ('25', 'NORTE DE SANTANDER'),
         ('26', 'QUINDÍO'), ('27', 'SANTANDER'), ('28', 'SUCRE'), ('29', 'TOLIMA'),
         ('31', 'VALLE DEL CAUCA'), ('40', 'ARAUCA'), ('44', 'CAQUETÁ'), ('46', 'CASANARE'),
         ('48', 'LA GUAJIRA'), ('50', 'GUAINÍA'), ('52', 'META'), ('54', 'GUAVIARE'),
         ('56', 'SAN ANDRÉS'), ('60', 'AMAZONAS'), ('64', 'PUTUMAYO'), ('68', 'VAUPÉS'),
         ('72', 'VICHADA'), ('88', 'CONSULADOS')
),
-- Municipios cuyo nombre en la fuente no sirve para mostrar (Bogotá llega como 'BOGOTA. D.C.').
municipio_oficial (codigo, nombre) AS (
  VALUES ('16001', 'BOGOTÁ D.C.')
),
variante AS (
  SELECT left(divipole, 2) AS codigo, nombre_departamento AS nombre, count(*) AS filas
    FROM dim
   WHERE nombre_departamento IS NOT NULL
   GROUP BY 1, 2
  UNION ALL
  SELECT left(divipole, 5), nombre_municipio, count(*)
    FROM dim
   WHERE nombre_municipio IS NOT NULL AND nombre_municipio <> 'TERRITORIAL'
   GROUP BY 1, 2
),
nombre_frecuente AS (
  SELECT DISTINCT ON (codigo) codigo, nombre
    FROM variante
   ORDER BY codigo, strpos(nombre, '?') > 0, filas DESC, nombre
),
nivel (nivel, largo, largo_padre) AS (
  VALUES ('departamento', 2, 0), ('municipio', 5, 2), ('zona', 7, 5), ('puesto', 9, 7)
),
unidad AS (
  SELECT DISTINCT left(p.ambito, n.largo) AS codigo, n.nivel, n.largo_padre
    FROM (SELECT DISTINCT ambito FROM ojo_aguila.votos_puesto) AS p
   CROSS JOIN nivel AS n
)
SELECT u.codigo COLLATE "C" AS codigo,
       u.nivel,
       left(u.codigo, u.largo_padre) COLLATE "C" AS padre,
       CASE u.nivel
         WHEN 'departamento' THEN coalesce(o.nombre, f.nombre, 'DEPARTAMENTO ' || u.codigo)
         WHEN 'municipio' THEN coalesce(m.nombre, f.nombre, 'MUNICIPIO ' || substr(u.codigo, 3, 3))
         WHEN 'zona' THEN 'ZONA ' || substr(u.codigo, 6, 2)
         ELSE CASE
                WHEN d.nombre_puesto IS NULL OR d.nombre_puesto IN ('0', 'TERRITORIAL') THEN 'PUESTO ' || substr(u.codigo, 8, 2)
                ELSE d.nombre_puesto
              END
       END COLLATE "default" AS nombre
  FROM unidad AS u
  LEFT JOIN departamento_oficial AS o ON u.nivel = 'departamento' AND o.codigo = u.codigo
  LEFT JOIN municipio_oficial AS m ON u.nivel = 'municipio' AND m.codigo = u.codigo
  LEFT JOIN nombre_frecuente AS f ON f.codigo = u.codigo
  LEFT JOIN dim AS d ON u.nivel = 'puesto' AND d.divipole = u.codigo
 ORDER BY 1
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS geografia_codigo_uidx ON ojo_aguila.geografia (codigo);
CREATE INDEX IF NOT EXISTS geografia_padre_idx ON ojo_aguila.geografia (padre);

COMMENT ON MATERIALIZED VIEW ojo_aguila.geografia IS
  'Unidades geográficas con votos (todas las presentes en votos_puesto y sus ancestros) y nombre limpio en MAYÚSCULAS desde data_reporte.dim_divipole. Excluye departamento 00 y registros TERRITORIAL sin votos.';
COMMENT ON COLUMN ojo_aguila.geografia.codigo IS 'Prefijo divipole: 2 departamento, 5 municipio, 7 zona, 9 puesto. Algunos puestos terminan en letras (p. ej. 0100199A1).';
COMMENT ON COLUMN ojo_aguila.geografia.nivel IS 'departamento | municipio | zona | puesto (validado en database/verify.sql: una vista materializada no admite CHECK).';
COMMENT ON COLUMN ojo_aguila.geografia.padre IS 'Código de la unidad contenedora; '''' para departamentos.';
COMMENT ON COLUMN ojo_aguila.geografia.nombre IS
  'Departamentos y Bogotá D.C.: nombre oficial con tildes. Demás niveles: nombre más frecuente de la fuente (prefiere variantes sin "?" de codificación). Respaldos: DEPARTAMENTO <cód>, MUNICIPIO <cód>, ZONA <cód>, PUESTO <cód>.';
