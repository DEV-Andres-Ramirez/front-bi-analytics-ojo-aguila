-- =====================================================================
-- OJO DE ÁGUILA — Recalcula el esquema ojo_aguila desde data_reporte.
--
-- Ejecutar con `pnpm db:refresh` después de cualquier cambio en la fuente
-- (p. ej. la corrección de la duplicidad de PRESIDENCIA) y luego
-- `pnpm db:verify`. El runner ejecuta todos los pasos en una sola
-- transacción: la API nunca mezcla datos viejos y nuevos, y un fallo deja
-- las vistas como estaban. Cada vista queda bloqueada desde su REFRESH
-- (sin CONCURRENTLY) hasta el COMMIT final, así que las consultas de la API
-- esperan durante el refresh: ejecutarlo en una ventana de bajo tráfico.
-- Las funciones de la clave (ojo_aguila.clave_candidato y afines) se crean en la
-- migración: el refresh las aplica tal como estén definidas en la base.
-- =====================================================================

-- @paso: Precondiciones (la fuente tiene filas y nadie la está recargando)
-- Un refresh sobre la fuente vacía o a medio cargar dejaría las vistas vacías o
-- incompletas. pg_locks es visible para cualquier rol: detecta TRUNCATE
-- (AccessExclusiveLock) e INSERT/UPDATE/DELETE (RowExclusiveLock) de otra sesión,
-- concedidos o en espera. No cuenta el autovacuum (ShareUpdateExclusiveLock).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_locks AS l
     WHERE l.locktype = 'relation'
       AND l.relation = 'data_reporte.data_electoral_analitica'::regclass
       AND l.pid <> pg_backend_pid()
       AND l.mode IN ('RowExclusiveLock', 'ShareRowExclusiveLock', 'ExclusiveLock', 'AccessExclusiveLock')
  ) THEN
    RAISE EXCEPTION 'Otra sesión está modificando data_reporte.data_electoral_analitica (¿recarga en curso?)'
      USING HINT = 'Espere a que termine data_reporte.pb_actualizar_data_election() y vuelva a ejecutar pnpm db:refresh.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM data_reporte.data_electoral_analitica) THEN
    RAISE EXCEPTION 'data_reporte.data_electoral_analitica no tiene filas: el refresh dejaría las vistas vacías'
      USING HINT = 'Confirme que la recarga de la fuente terminó y vuelva a ejecutar pnpm db:refresh.';
  END IF;
END
$$;

-- @paso: nombre_frecuencia (lectura completa de la tabla base)
REFRESH MATERIALIZED VIEW ojo_aguila.nombre_frecuencia;
ANALYZE ojo_aguila.nombre_frecuencia;

-- @paso: registro_eleccion (id permanente para las elecciones nuevas)
INSERT INTO ojo_aguila.registro_eleccion (tipificacion, corporacion, periodo)
SELECT d.tipificacion, d.corporacion, d.periodo
  FROM (SELECT DISTINCT tipificacion, corporacion, periodo FROM ojo_aguila.nombre_frecuencia) AS d
 WHERE NOT EXISTS (
         SELECT 1
           FROM ojo_aguila.registro_eleccion AS r
          WHERE r.tipificacion = d.tipificacion AND r.corporacion = d.corporacion AND r.periodo = d.periodo
       )
 ORDER BY d.tipificacion COLLATE "C", d.corporacion COLLATE "C", d.periodo COLLATE "C";
ANALYZE ojo_aguila.registro_eleccion;

-- @paso: eleccion
REFRESH MATERIALIZED VIEW ojo_aguila.eleccion;
ANALYZE ojo_aguila.eleccion;

-- @paso: candidato_codigo
REFRESH MATERIALIZED VIEW ojo_aguila.candidato_codigo;
ANALYZE ojo_aguila.candidato_codigo;

-- @paso: partido
REFRESH MATERIALIZED VIEW ojo_aguila.partido;
ANALYZE ojo_aguila.partido;

-- @paso: candidato
REFRESH MATERIALIZED VIEW ojo_aguila.candidato;
ANALYZE ojo_aguila.candidato;

-- @paso: votos_puesto (lectura completa de la tabla base)
REFRESH MATERIALIZED VIEW ojo_aguila.votos_puesto;
ANALYZE ojo_aguila.votos_puesto;

-- @paso: votos_zona
REFRESH MATERIALIZED VIEW ojo_aguila.votos_zona;
ANALYZE ojo_aguila.votos_zona;

-- @paso: votos_municipio
REFRESH MATERIALIZED VIEW ojo_aguila.votos_municipio;
ANALYZE ojo_aguila.votos_municipio;

-- @paso: votos_departamento
REFRESH MATERIALIZED VIEW ojo_aguila.votos_departamento;
ANALYZE ojo_aguila.votos_departamento;

-- @paso: geografia
REFRESH MATERIALIZED VIEW ojo_aguila.geografia;
ANALYZE ojo_aguila.geografia;
