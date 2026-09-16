@AGENTS.md

# Notas para Claude Code

- Contexto completo del proyecto: `AGENTS.md` (arriba), `README.md` y `database/README.md`. El plan original de construcción está en el historial del equipo; el código y estos documentos son la fuente de verdad actual.
- **Idioma:** el usuario trabaja en español. Responde en español y usa nombres de dominio en español en el código (`eleccion`, `competidor`, `ambito`, `circunscripcion`…).
- **Next.js 16:** antes de usar cualquier API de Next consulta `node_modules/next/dist/docs/`, porque muchas cosas cambiaron respecto al entrenamiento.
- **Verificación obligatoria** antes de reportar un cambio como terminado: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Para cambios visuales, levanta la app y revísala en el navegador en claro, oscuro y móvil.
- **Base de datos compartida:**
  - Solo `SELECT` sobre `data_reporte`.
  - Los cambios en `ojo_aguila` se hacen vía `database/migrations` + `pnpm db:*`.
  - Antes de cualquier `DROP` o refresh, confirma que la fuente tiene filas y que no se está recargando.
  - Nunca borres `ojo_aguila.registro_eleccion`.
  - Operaciones destructivas o de roles/permisos: pedir confirmación explícita al usuario.
- **Credenciales:**
  - No pegues el contenido de `.env` en respuestas, commits, docs ni artefactos.
  - En pruebas de navegador no escribas el token en formularios: pide al usuario que inicie sesión, o firma una cookie de prueba solo en scripts temporales fuera del repo.
- **Contratos:** si cambias una respuesta de la API, edita primero `src/domain/types.ts` y luego servidor y cliente. Cualquier regla electoral nueva (corporación, circunscripción, tipo de voto) va en `src/domain/votos.ts` y en la migración SQL, con tests.
- **Commits:** solo cuando el usuario lo pida, en la rama de trabajo actual (no en `master`).
