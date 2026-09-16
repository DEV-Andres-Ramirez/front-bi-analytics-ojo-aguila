import { conSesion, consultaCompetidorSchema, jsonOk, parseQuery } from "@/server/http";
import { obtenerDetalleCompetidor } from "@/server/services/resultados.service";

export const GET = conSesion(async (request) =>
  jsonOk(await obtenerDetalleCompetidor(parseQuery(request, consultaCompetidorSchema))),
);
