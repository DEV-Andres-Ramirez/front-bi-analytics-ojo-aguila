import { describe, expect, it } from "vitest";
import type { Competidor, ResultadosResponse, UnidadResultado } from "@/domain/types";
import { PALETTE_SIZE } from "@/lib/palette";
import { asignarColores, asignarIndicesColor, ganadoresPorUnidades } from "./use-colores-competidores";

function competidor(id: string, colorIndex: number): Competidor {
  return { id, nombre: id, detalle: "", tipo: "CANDIDATO", votos: 0, pctValidos: 0, colorIndex };
}

function unidad(codigo: string, ganador: string | null, empate = false): UnidadResultado {
  return {
    unidad: { codigo, nivel: "departamento", nombre: codigo },
    totalVotos: 0,
    votosValidos: 0,
    votosBlanco: 0,
    pctBlanco: 0,
    ganador: ganador ? { id: ganador, votos: 10, pct: 0.5 } : null,
    segundo: null,
    margenPct: null,
    empate,
    top: {},
  };
}

function respuesta(parcial: Partial<ResultadosResponse>): ResultadosResponse {
  return {
    eleccion: { tipificacion: "CONGRESO", corporacion: "SENADO", periodo: "2022" },
    dimension: "candidato",
    ambito: { unidad: { codigo: "", nivel: "nacional", nombre: "Colombia" }, ruta: [], nivelHijos: "departamento" },
    kpis: {
      totalVotos: 0,
      votosValidos: 0,
      votosCandidatos: 0,
      votosBlanco: 0,
      votosNulos: 0,
      votosNoMarcados: 0,
      pctBlanco: 0,
      pctNulos: 0,
      pctNoMarcados: 0,
    },
    competidores: [],
    totalCompetidores: 0,
    votoLista: null,
    hijos: [],
    topIds: [],
    ...parcial,
  };
}

describe("asignarIndicesColor", () => {
  it("conserva el color nacional cuando está libre", () => {
    const indices = asignarIndicesColor([competidor("a", 3), competidor("b", 0)]);
    expect([...indices]).toEqual([
      ["a", 3],
      ["b", 0],
    ]);
  });

  it("da colores distintos a competidores fuera de la paleta (sin repetir grises)", () => {
    const indices = asignarIndicesColor([competidor("a", 12), competidor("b", 40), competidor("c", 2)]);
    expect(indices.get("c")).toBe(2);
    expect(new Set(indices.values()).size).toBe(3);
    expect([indices.get("a"), indices.get("b")]).toEqual([0, 1]);
  });

  it("colorea solo los primeros ids distintos que caben en la paleta", () => {
    const prioridad = Array.from({ length: PALETTE_SIZE + 3 }, (_, i) => competidor(`c${i}`, 100 + i));
    const indices = asignarIndicesColor([...prioridad, ...prioridad]);
    expect(indices.size).toBe(PALETTE_SIZE);
    expect(indices.has(`c${PALETTE_SIZE}`)).toBe(false);
  });
});

describe("ganadoresPorUnidades", () => {
  it("cuenta unidades ganadas sin incluir empates ni unidades sin ganador", () => {
    const unidades = [unidad("01", "a"), unidad("03", "b"), unidad("05", "b"), unidad("07", "a", true), unidad("09", null)];
    expect(ganadoresPorUnidades(unidades)).toEqual([
      { id: "b", unidades: 2 },
      { id: "a", unidades: 1 },
    ]);
  });
});

describe("asignarColores", () => {
  it("prioriza el top del ámbito y los ganadores del mapa nacional sobre el resto del ranking", () => {
    const competidores = Array.from({ length: 12 }, (_, i) => competidor(`c${i}`, i));
    const { competidores: indices } = asignarColores(
      respuesta({
        competidores,
        topIds: ["c0", "c1", "c2", "c3", "c4"],
        hijos: [unidad("01", "c11"), unidad("03", "c11"), unidad("05", "c10")],
      }),
    );
    expect(indices.has("c11")).toBe(true);
    expect(indices.has("c10")).toBe(true);
    expect(indices.has("c7")).toBe(false);
    expect(new Set(indices.values()).size).toBe(indices.size);
  });

  it("fuera del ámbito nacional sigue el orden del ranking", () => {
    const competidores = Array.from({ length: 12 }, (_, i) => competidor(`c${i}`, 20 + i));
    const { competidores: indices } = asignarColores(
      respuesta({
        ambito: { unidad: { codigo: "13", nivel: "departamento", nombre: "Córdoba" }, ruta: [], nivelHijos: "municipio" },
        competidores,
        topIds: ["c0", "c1", "c2", "c3", "c4"],
        hijos: [unidad("13001", "c11")],
      }),
    );
    expect(indices.has("c11")).toBe(false);
    expect(["c0", "c1", "c2", "c3", "c4"].map((id) => indices.get(id))).toEqual([0, 1, 2, 3, 4]);
  });

  it("en la dimensión partido el voto por lista usa los colores de los competidores", () => {
    const resultado = asignarColores(respuesta({ dimension: "partido", competidores: [competidor("00001", 9)] }));
    expect(resultado.partidos).toBe(resultado.competidores);
  });
});
