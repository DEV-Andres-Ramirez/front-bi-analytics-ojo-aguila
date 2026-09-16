import { describe, expect, it } from "vitest";
import {
  formatCantidad,
  formatCompacto,
  formatNombre,
  formatNumero,
  formatPct,
  formatPuntos,
  normalizarBusqueda,
} from "./format";

/** Los separadores de Intl (espacio fino, espacio duro) varían entre versiones de ICU. */
function sinEspacios(valor: string): string {
  return valor.replace(/\s/g, "");
}

describe("formatNumero", () => {
  it("usa punto como separador de miles (es-CO)", () => {
    expect(formatNumero(18636732)).toBe("18.636.732");
    expect(formatNumero(999)).toBe("999");
    expect(formatNumero(0)).toBe("0");
  });
});

describe("formatCompacto", () => {
  it("abrevia con un decimal", () => {
    expect(sinEspacios(formatCompacto(1234567))).toBe("1,2M");
    expect(sinEspacios(formatCompacto(18636732))).toBe("18,6M");
    expect(formatCompacto(999)).toBe("999");
  });

  it("usa la misma abreviatura para todos los miles de un eje", () => {
    expect([7500, 10000, 250000].map((valor) => sinEspacios(formatCompacto(valor)))).toEqual([
      "7,5mil",
      "10mil",
      "250mil",
    ]);
  });
});

describe("formatCantidad", () => {
  it("concuerda el sustantivo con la cantidad", () => {
    expect(formatCantidad(1, "puesto", "puestos")).toBe("1 puesto");
    expect(formatCantidad(0, "puesto", "puestos")).toBe("0 puestos");
    expect(formatCantidad(1224, "zona", "zonas")).toBe("1.224 zonas");
  });
});

describe("formatPct", () => {
  it("formatea proporciones 0..1 con un decimal y coma", () => {
    expect(sinEspacios(formatPct(0.4567))).toBe("45,7%");
    expect(sinEspacios(formatPct(0))).toBe("0,0%");
    expect(sinEspacios(formatPct(1))).toBe("100,0%");
  });
});

describe("formatPuntos", () => {
  it("expresa diferencias de proporción en puntos porcentuales", () => {
    expect(formatPuntos(0.123)).toBe("12,3 pp");
    expect(formatPuntos(0)).toBe("0,0 pp");
    expect(formatPuntos(-0.05)).toBe("-5,0 pp");
  });
});

describe("formatNombre", () => {
  it("convierte mayúsculas a formato título con conectores en minúscula", () => {
    expect(formatNombre("NORTE DE SANTANDER")).toBe("Norte de Santander");
    expect(formatNombre("DE LA CRUZ")).toBe("De la Cruz");
    expect(formatNombre("SAN ANDRES Y PROVIDENCIA")).toBe("San Andres y Providencia");
  });

  it("conserva siglas con puntos o entre comillas", () => {
    expect(formatNombre("BOGOTA D.C.")).toBe("Bogota D.C.");
    expect(formatNombre('MOVIMIENTO ALTERNATIVO INDIGENA Y SOCIAL "MAIS"')).toBe(
      'Movimiento Alternativo Indigena y Social "MAIS"',
    );
  });

  it("respeta tildes y eñes", () => {
    expect(formatNombre("ÁLVARO PEÑA")).toBe("Álvaro Peña");
  });

  it("normaliza espacios sobrantes", () => {
    expect(formatNombre("  PARTIDO   LIBERAL  ")).toBe("Partido Liberal");
    expect(formatNombre("   ")).toBe("");
  });
});

describe("normalizarBusqueda", () => {
  it("quita tildes, mayúsculas y espacios repetidos", () => {
    expect(normalizarBusqueda("  Bogotá   D.C. ")).toBe("bogota d.c.");
    expect(normalizarBusqueda("PEÑOL")).toBe("penol");
    expect(normalizarBusqueda("Ciénaga de Oro")).toBe("cienaga de oro");
  });
});
