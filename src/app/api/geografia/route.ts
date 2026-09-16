import { conSesion, jsonOk } from "@/server/http";
import { obtenerGeografia } from "@/server/services/resultados.service";

export const GET = conSesion(async () => jsonOk(await obtenerGeografia()));
