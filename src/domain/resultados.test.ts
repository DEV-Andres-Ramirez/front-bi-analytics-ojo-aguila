import { describe, expect, it } from "vitest";
import {
  calcularKpis,
  codigosRuta,
  COLOR_SIN_RANKING,
  compararCompetidores,
  construirCompetidores,
  construirDesempeno,
  construirHijos,
  construirVotoLista,
  esIdCompetidorValido,
  idCompetidor,
  idsPrincipales,
  indicesDeColor,
  LIMITE_TOP_IDS,
  planHijos,
  proporcion,
  totalesDeVotos,
  type NombresEleccion,
  type ResumenUnidad,
  type TotalesVoto,
  type UnidadResolver,
  type VotosClave,
} from "./resultados";
import type { Competidor } from "./types";

function votos(
  codPartido: string,
  codCandidato: string,
  cantidad: number,
  clave = "00",
  territorio = "",
  territorios = 1,
): VotosClave {
  return { codPartido, codCandidato, clave, votos: cantidad, territorio, territorios };
}

const PARTIDO_A = "00001";
const PARTIDO_B = "00002";
const PARTIDO_C = "00003";
const SIN_PARTIDO = "00000";

/** Ámbito de Congreso: lista + preferente (A), solo lista (B), candidato departamental (C) y votos especiales. */
const VOTOS_AMBITO: VotosClave[] = [
  votos(PARTIDO_A, "00000", 100),
  votos(PARTIDO_A, "00001", 300),
  votos(PARTIDO_A, "00002", 50),
  votos(PARTIDO_B, "00000", 400),
  votos(PARTIDO_C, "00007", 200, "05"),
  votos(SIN_PARTIDO, "00996", 50),
  votos(SIN_PARTIDO, "00997", 30),
  votos(SIN_PARTIDO, "00998", 20),
];

const NOMBRES: NombresEleccion = {
  candidatos: new Map([
    ["00001-00000-00", { nombre: "Partido A", partido: "Partido A" }],
    ["00001-00001-00", { nombre: "Ana Pérez", partido: "Partido A" }],
    ["00001-00002-00", { nombre: "Luis Gómez", partido: "Partido A" }],
    ["00002-00000-00", { nombre: "Partido B", partido: "Partido B" }],
    ["00003-00007-05", { nombre: "Marta Ruiz", partido: "Partido C" }],
  ]),
  partidos: new Map([
    [PARTIDO_A, "Partido A"],
    [PARTIDO_B, "Partido B"],
    [PARTIDO_C, "Partido C"],
  ]),
  lugares: new Map([
    ["05", "Antioquia"],
    ["05001", "Medellín"],
  ]),
};

const SIN_COLORES = new Map<string, number>();

const unidadMunicipio: UnidadResolver = (codigo) => ({ codigo, nivel: "municipio", nombre: `Municipio ${codigo}` });

function totales(total: number, blanco = 0, nulos = 0, noMarcados = 0): TotalesVoto {
  return { total, blanco, nulos, noMarcados };
}

function resumen(codigo: string, totalesUnidad: TotalesVoto, competidores: [string, number][]): ResumenUnidad {
  return { codigo, totales: totalesUnidad, competidores: competidores.map(([id, cantidad]) => ({ id, votos: cantidad })) };
}

describe("proporcion", () => {
  it("divide y retorna 0 cuando el divisor es 0", () => {
    expect(proporcion(1, 4)).toBe(0.25);
    expect(proporcion(5, 0)).toBe(0);
    expect(proporcion(0, 0)).toBe(0);
  });

  it("redondea a 5 decimales", () => {
    expect(proporcion(1, 3)).toBe(0.33333);
    expect(proporcion(2, 3)).toBe(0.66667);
    expect(proporcion(1, 7_000_000)).toBe(0);
    expect(JSON.stringify(proporcion(1_234_567, 9_876_543))).toBe("0.125");
  });
});

describe("totalesDeVotos y calcularKpis", () => {
  it("separa blanco, nulos y no marcados del voto por competidores", () => {
    expect(totalesDeVotos(VOTOS_AMBITO)).toEqual(totales(1150, 50, 30, 20));
  });

  it("calcula válidos como candidatos y listas más blanco, con blanco sobre válidos y el resto sobre total", () => {
    const kpis = calcularKpis(totalesDeVotos(VOTOS_AMBITO));

    expect(kpis).toMatchObject({
      totalVotos: 1150,
      votosCandidatos: 1050,
      votosValidos: 1100,
      votosBlanco: 50,
      votosNulos: 30,
      votosNoMarcados: 20,
    });
    expect(kpis.pctBlanco).toBeCloseTo(50 / 1100);
    expect(kpis.pctNulos).toBeCloseTo(30 / 1150);
    expect(kpis.pctNoMarcados).toBeCloseTo(20 / 1150);
  });

  it("no divide por cero en un ámbito sin votos", () => {
    expect(calcularKpis(totalesDeVotos([]))).toEqual({
      totalVotos: 0,
      votosValidos: 0,
      votosCandidatos: 0,
      votosBlanco: 0,
      votosNulos: 0,
      votosNoMarcados: 0,
      pctBlanco: 0,
      pctNulos: 0,
      pctNoMarcados: 0,
    });
  });

  it("con solo votos nulos no hay válidos y el porcentaje de blanco es 0", () => {
    const kpis = calcularKpis(totalesDeVotos([votos(SIN_PARTIDO, "00997", 10)]));
    expect(kpis.votosValidos).toBe(0);
    expect(kpis.pctBlanco).toBe(0);
    expect(kpis.pctNulos).toBe(1);
  });
});

describe("identificadores de competidor", () => {
  it("construye el id según la dimensión", () => {
    const fila = votos(PARTIDO_C, "00007", 1, "05");
    expect(idCompetidor(fila, "candidato")).toBe("00003-00007-05");
    expect(idCompetidor(fila, "partido")).toBe(PARTIDO_C);
  });

  it("valida el formato del id para cada dimensión", () => {
    expect(esIdCompetidorValido("00001-00002-05", "candidato")).toBe(true);
    expect(esIdCompetidorValido("00001-00002-05001", "candidato")).toBe(true);
    expect(esIdCompetidorValido("00001-00002-05001:3fa2c9", "candidato")).toBe(true);
    expect(esIdCompetidorValido("00001", "partido")).toBe(true);
    expect(esIdCompetidorValido("00001-00002-05001:3fa2c9", "partido")).toBe(false);
    expect(esIdCompetidorValido("00001-00002-05001:<script>", "candidato")).toBe(false);
    expect(esIdCompetidorValido("00001", "candidato")).toBe(false);
    expect(esIdCompetidorValido("00001-00002-05", "partido")).toBe(false);
    expect(esIdCompetidorValido("0001-00002-05", "candidato")).toBe(false);
    expect(esIdCompetidorValido("00001-00002-05' OR 1=1", "candidato")).toBe(false);
  });
});

describe("compararCompetidores", () => {
  it("ordena por votos descendentes y desempata por id ascendente", () => {
    const ordenados = [
      { id: "00009-00001-00", votos: 10 },
      { id: "00002-00001-00", votos: 10 },
      { id: "00005-00001-00", votos: 30 },
    ].sort(compararCompetidores);

    expect(ordenados.map((c) => c.id)).toEqual(["00005-00001-00", "00002-00001-00", "00009-00001-00"]);
  });
});

describe("indicesDeColor", () => {
  it("asigna la posición en el ranking sin contar votos especiales", () => {
    const nacionales = [
      votos(SIN_PARTIDO, "00996", 5000),
      votos(PARTIDO_B, "00000", 900),
      votos(PARTIDO_A, "00001", 1000),
    ];

    expect([...indicesDeColor(nacionales, "candidato")]).toEqual([
      ["00001-00001-00", 0],
      ["00002-00000-00", 1],
    ]);
    expect([...indicesDeColor(nacionales, "partido")]).toEqual([
      [PARTIDO_A, 0],
      [PARTIDO_B, 1],
    ]);
  });
});

describe("construirCompetidores · dimensión candidato", () => {
  const colores = indicesDeColor([votos(PARTIDO_A, "00001", 1000), votos(PARTIDO_B, "00000", 900)], "candidato");
  const competidores = construirCompetidores(VOTOS_AMBITO, "candidato", NOMBRES, colores);
  const porId = (id: string) => competidores.find((c) => c.id === id) as Competidor;

  it("excluye votos especiales y ordena por votos", () => {
    expect(competidores.map((c) => [c.id, c.votos])).toEqual([
      ["00002-00000-00", 400],
      ["00001-00001-00", 300],
      ["00003-00007-05", 200],
      ["00001-00000-00", 100],
      ["00001-00002-00", 50],
    ]);
  });

  it("calcula el porcentaje sobre los votos válidos del ámbito", () => {
    expect(porId("00002-00000-00").pctValidos).toBeCloseTo(400 / 1100);
  });

  it("describe listas y candidatos sin lugar cuando el ámbito está en su circunscripción", () => {
    expect(porId("00002-00000-00")).toMatchObject({ nombre: "Partido B", detalle: "Voto solo por la lista", tipo: "LISTA" });
    expect(porId("00001-00001-00")).toMatchObject({ nombre: "Ana Pérez", detalle: "Partido A", tipo: "CANDIDATO" });
    expect(porId("00003-00007-05")).toMatchObject({ nombre: "Marta Ruiz", detalle: "Partido C" });
  });

  it("con mostrarLugar añade el territorio real de los votos, no el de la clave", () => {
    const conLugar = construirCompetidores(
      [
        votos(PARTIDO_C, "00007", 200, "05", "05"),
        // Sin desambiguar (clave "00") pero con votos en un solo departamento: también lleva lugar.
        votos(PARTIDO_A, "00001", 300, "00", "05"),
        // Circunscripción especial: abarca varios departamentos y no lleva lugar.
        votos(PARTIDO_B, "00000", 400, "00", "05", 3),
      ],
      "candidato",
      NOMBRES,
      SIN_COLORES,
      { mostrarLugar: true },
    );
    const detalle = (id: string) => conLugar.find((c) => c.id === id)?.detalle;

    expect(detalle("00003-00007-05")).toBe("Partido C · Antioquia");
    expect(detalle("00001-00001-00")).toBe("Partido A · Antioquia");
    expect(detalle("00002-00000-00")).toBe("Voto solo por la lista");
  });

  it("añade el municipio a las claves municipales y de JAL, con respaldo si no hay nombre", () => {
    const nombres: NombresEleccion = {
      ...NOMBRES,
      candidatos: new Map([
        ["00003-00007-05001", { nombre: "Juan Díaz", partido: "Partido C" }],
        ["00003-00007-05001:3fa2c9", { nombre: "Rosa Mejía", partido: "Partido C" }],
        ["00003-00007-05001:0b1d2e", { nombre: "Pedro Gil", partido: "Partido C" }],
      ]),
    };
    const territoriales = construirCompetidores(
      [
        votos(PARTIDO_C, "00007", 30, "05001", "05001"),
        votos(PARTIDO_C, "00007", 20, "05001:3fa2c9", "05001"),
        votos(PARTIDO_C, "00007", 10, "05001:0b1d2e", "05001"),
        votos(PARTIDO_C, "00007", 5, "08001", "08001"),
      ],
      "candidato",
      nombres,
      SIN_COLORES,
      { mostrarLugar: true },
    );

    expect(territoriales.map((c) => [c.id, c.nombre, c.detalle])).toEqual([
      ["00003-00007-05001", "Juan Díaz", "Partido C · Medellín"],
      ["00003-00007-05001:3fa2c9", "Rosa Mejía", "Partido C · Medellín"],
      ["00003-00007-05001:0b1d2e", "Pedro Gil", "Partido C · Medellín"],
      ["00003-00007-08001", "Candidato 00007", "Partido C · Municipio 08001"],
    ]);
  });

  it("usa el color del ranking nacional y uno fuera de paleta si no aparece en él", () => {
    expect(porId("00001-00001-00").colorIndex).toBe(0);
    expect(porId("00002-00000-00").colorIndex).toBe(1);
    expect(porId("00003-00007-05").colorIndex).toBe(COLOR_SIN_RANKING);
  });

  it("suma filas repetidas de un mismo candidato", () => {
    const [unico] = construirCompetidores(
      [votos(PARTIDO_A, "00001", 10), votos(PARTIDO_A, "00001", 5)],
      "candidato",
      NOMBRES,
      SIN_COLORES,
    );
    expect(unico).toMatchObject({ id: "00001-00001-00", votos: 15, pctValidos: 1 });
  });

  it("retorna una lista vacía cuando solo hay votos especiales", () => {
    expect(construirCompetidores([votos(SIN_PARTIDO, "00996", 10)], "candidato", NOMBRES, SIN_COLORES)).toEqual([]);
  });
});

describe("construirCompetidores · dimensión partido", () => {
  const colores = indicesDeColor([votos(PARTIDO_B, "00000", 900), votos(PARTIDO_A, "00001", 100)], "partido");
  const competidores = construirCompetidores(VOTOS_AMBITO, "partido", NOMBRES, colores);

  it("suma lista y candidatos por partido", () => {
    expect(competidores.map((c) => [c.id, c.votos])).toEqual([
      [PARTIDO_A, 450],
      [PARTIDO_B, 400],
      [PARTIDO_C, 200],
    ]);
  });

  it("describe cuántos candidatos tienen votos, sin contar la lista", () => {
    expect(competidores.map((c) => [c.nombre, c.detalle, c.tipo])).toEqual([
      ["Partido A", "2 candidatos", "CANDIDATO"],
      ["Partido B", "Voto por lista", "CANDIDATO"],
      ["Partido C", "1 candidato", "CANDIDATO"],
    ]);
  });

  it("usa el ranking nacional de partidos para el color", () => {
    expect(competidores.map((c) => c.colorIndex)).toEqual([1, 0, COLOR_SIN_RANKING]);
  });
});

describe("idsPrincipales", () => {
  it("toma los primeros competidores del ranking", () => {
    const competidores = Array.from({ length: 8 }, (_, i) =>
      construirCompetidores([votos(PARTIDO_A, `0000${i + 1}`, 100 - i)], "candidato", NOMBRES, SIN_COLORES)[0],
    );
    expect(idsPrincipales(competidores)).toHaveLength(LIMITE_TOP_IDS);
    expect(idsPrincipales(competidores)[0]).toBe("00001-00001-00");
    expect(idsPrincipales([])).toEqual([]);
  });
});

describe("construirVotoLista", () => {
  it("separa voto por lista y preferente por partido, en orden de votos totales", () => {
    const coloresPartidos = new Map([
      [PARTIDO_B, 0],
      [PARTIDO_A, 1],
    ]);

    expect(construirVotoLista(VOTOS_AMBITO, NOMBRES, coloresPartidos)).toEqual([
      { codPartido: PARTIDO_A, nombre: "Partido A", votosLista: 100, votosPreferente: 350, colorIndex: 1 },
      { codPartido: PARTIDO_B, nombre: "Partido B", votosLista: 400, votosPreferente: 0, colorIndex: 0 },
      { codPartido: PARTIDO_C, nombre: "Partido C", votosLista: 0, votosPreferente: 200, colorIndex: COLOR_SIN_RANKING },
    ]);
  });

  it("desempata por código de partido", () => {
    const lista = construirVotoLista([votos(PARTIDO_B, "00000", 10), votos(PARTIDO_A, "00000", 10)], NOMBRES, SIN_COLORES);
    expect(lista.map((p) => p.codPartido)).toEqual([PARTIDO_A, PARTIDO_B]);
  });
});

describe("construirHijos", () => {
  const hijos = construirHijos(
    [
      resumen("05001", totales(100, 10, 5, 5), [
        ["a", 30],
        ["b", 50],
      ]),
      resumen("05002", totales(300), [["a", 300]]),
      resumen("05003", totales(0), []),
      resumen("05004", totales(0), []),
    ],
    ["a", "c"],
    unidadMunicipio,
  );
  const porCodigo = (codigo: string) => hijos.find((h) => h.unidad.codigo === codigo)!;

  it("ordena por votos totales y desempata por código", () => {
    expect(hijos.map((h) => h.unidad.codigo)).toEqual(["05002", "05001", "05003", "05004"]);
    expect(porCodigo("05001").unidad).toEqual({ codigo: "05001", nivel: "municipio", nombre: "Municipio 05001" });
  });

  it("calcula ganador, segundo y margen sobre los válidos de la unidad, con proporciones redondeadas", () => {
    const unidad = porCodigo("05001");

    expect(unidad).toMatchObject({ totalVotos: 100, votosValidos: 90, votosBlanco: 10, pctBlanco: 0.11111 });
    expect(unidad.ganador).toEqual({ id: "b", votos: 50, pct: 0.55556 });
    expect(unidad.segundo).toEqual({ id: "a", votos: 30, pct: 0.33333 });
    expect(unidad.margenPct).toBe(0.22223);
    expect(unidad.empate).toBe(false);
  });

  it("deja segundo y margen en null con un único competidor", () => {
    const unidad = porCodigo("05002");
    expect(unidad.ganador).toEqual({ id: "a", votos: 300, pct: 1 });
    expect(unidad.segundo).toBeNull();
    expect(unidad.margenPct).toBeNull();
    expect(unidad.empate).toBe(false);
  });

  it("maneja unidades sin votos sin dividir por cero", () => {
    expect(porCodigo("05003")).toMatchObject({
      ganador: null,
      segundo: null,
      margenPct: null,
      empate: false,
      pctBlanco: 0,
    });
  });

  it("reporta los votos de cada id principal, con 0 si no tiene", () => {
    expect(porCodigo("05001").top).toEqual({ a: 30, c: 0 });
    expect(porCodigo("05003").top).toEqual({ a: 0, c: 0 });
  });

  it("marca empate cuando ganador y segundo tienen los mismos votos", () => {
    const [unidad] = construirHijos(
      [
        resumen("05001", totales(25), [
          ["z", 10],
          ["m", 10],
          ["a", 5],
        ]),
      ],
      [],
      unidadMunicipio,
    );
    expect(unidad.empate).toBe(true);
    expect([unidad.ganador?.votos, unidad.segundo?.votos]).toEqual([10, 10]);
    expect(unidad.margenPct).toBe(0);
  });

  it("no marca empate cuando solo empatan competidores detrás del ganador", () => {
    const [unidad] = construirHijos(
      [
        resumen("05001", totales(30), [
          ["a", 10],
          ["b", 10],
          ["c", 10],
          ["d", 11],
        ]),
      ],
      [],
      unidadMunicipio,
    );
    expect(unidad.ganador?.id).toBe("d");
    expect(unidad.empate).toBe(false);
  });
});

describe("construirDesempeno", () => {
  it("calcula el porcentaje sobre válidos y ordena por votos", () => {
    const unidades = construirDesempeno(
      [
        { codigo: "05002", totales: totales(20), votos: 0, posicion: 3 },
        { codigo: "05001", totales: totales(110, 5, 10), votos: 40, posicion: 1 },
      ],
      unidadMunicipio,
    );

    expect(unidades).toEqual([
      { unidad: unidadMunicipio("05001"), votos: 40, votosValidos: 100, pct: 0.4, posicion: 1 },
      { unidad: unidadMunicipio("05002"), votos: 0, votosValidos: 20, pct: 0, posicion: 3 },
    ]);
  });

  it("conserva la posición null de las unidades sin votos por competidores", () => {
    const [unidad] = construirDesempeno(
      [{ codigo: "05003", totales: totales(4, 3, 1), votos: 0, posicion: null }],
      unidadMunicipio,
    );
    expect(unidad).toMatchObject({ votos: 0, votosValidos: 3, pct: 0, posicion: null });
  });
});

describe("planHijos", () => {
  it("baja un nivel desde cada ámbito", () => {
    expect(planHijos("")).toEqual({ nivel: "departamento", padre: "" });
    expect(planHijos("05")).toEqual({ nivel: "municipio", padre: "05" });
    expect(planHijos("05001")).toEqual({ nivel: "zona", padre: "05001" });
    expect(planHijos("0500101")).toEqual({ nivel: "puesto", padre: "0500101" });
  });

  it("salta directo a los puestos de un municipio con una sola zona", () => {
    expect(planHijos("05002", "0500200")).toEqual({ nivel: "puesto", padre: "0500200" });
  });

  it("solo aplica el salto a municipios", () => {
    expect(planHijos("05", "0500200")).toEqual({ nivel: "municipio", padre: "05" });
  });

  it("retorna null en la hoja (puesto), también con código alfanumérico", () => {
    expect(planHijos("050010101")).toBeNull();
    expect(planHijos("0100199A1")).toBeNull();
  });
});

describe("codigosRuta", () => {
  const zonasUnicas = new Map([["05002", "0500200"]]);

  it("incluye todos los niveles cuando no hay salto", () => {
    expect(codigosRuta("050010101", zonasUnicas)).toEqual(["", "05", "05001", "0500101", "050010101"]);
    expect(codigosRuta("", zonasUnicas)).toEqual([""]);
  });

  it("omite la zona única intermedia de un municipio", () => {
    expect(codigosRuta("050020001", zonasUnicas)).toEqual(["", "05", "05002", "050020001"]);
  });

  it("conserva la zona única cuando es el ámbito actual", () => {
    expect(codigosRuta("0500200", zonasUnicas)).toEqual(["", "05", "05002", "0500200"]);
  });

  it("recorre puestos con código alfanumérico", () => {
    expect(codigosRuta("0100199A1", zonasUnicas)).toEqual(["", "01", "01001", "0100199", "0100199A1"]);
    expect(codigosRuta("0500200A1", zonasUnicas)).toEqual(["", "05", "05002", "0500200A1"]);
  });
});
