import { conSesion, consultaResultadosSchema, jsonOk, parseQuery } from "@/server/http";
import { obtenerResultados } from "@/server/services/resultados.service";

export const GET = conSesion(async (request) =>
  jsonOk(await obtenerResultados(parseQuery(request, consultaResultadosSchema))),
);
