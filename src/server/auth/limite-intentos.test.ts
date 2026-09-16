import { describe, expect, it } from "vitest";
import { crearLimiteIntentos, origenDeSolicitud } from "./limite-intentos";

const VENTANA_MS = 5 * 60 * 1000;

function limiteConReloj(opciones: { maximo?: number; maxOrigenes?: number } = {}) {
  const reloj = { ms: 0 };
  const limite = crearLimiteIntentos({ maximo: 5, ventanaMs: VENTANA_MS, ahora: () => reloj.ms, ...opciones });
  return { limite, reloj };
}

function fallar(limite: ReturnType<typeof crearLimiteIntentos>, origen: string, veces: number) {
  for (let i = 0; i < veces; i++) limite.registrarFallo(origen);
}

describe("crearLimiteIntentos", () => {
  it("bloquea al alcanzar el máximo de fallos dentro de la ventana", () => {
    const { limite } = limiteConReloj();
    fallar(limite, "1.1.1.1", 4);
    expect(limite.bloqueado("1.1.1.1")).toBe(false);

    limite.registrarFallo("1.1.1.1");
    expect(limite.bloqueado("1.1.1.1")).toBe(true);
  });

  it("cuenta cada origen por separado", () => {
    const { limite } = limiteConReloj();
    fallar(limite, "1.1.1.1", 5);
    expect(limite.bloqueado("1.1.1.1")).toBe(true);
    expect(limite.bloqueado("2.2.2.2")).toBe(false);
  });

  it("desbloquea cuando vence la ventana, contada desde el primer fallo", () => {
    const { limite, reloj } = limiteConReloj();
    limite.registrarFallo("1.1.1.1");
    reloj.ms = VENTANA_MS - 1;
    fallar(limite, "1.1.1.1", 4);
    expect(limite.bloqueado("1.1.1.1")).toBe(true);

    reloj.ms = VENTANA_MS;
    expect(limite.bloqueado("1.1.1.1")).toBe(false);
    limite.registrarFallo("1.1.1.1");
    expect(limite.bloqueado("1.1.1.1")).toBe(false);
  });

  it("reinicia la cuenta de un origen", () => {
    const { limite } = limiteConReloj();
    fallar(limite, "1.1.1.1", 5);
    limite.reiniciar("1.1.1.1");
    expect(limite.bloqueado("1.1.1.1")).toBe(false);
  });

  it("acota la memoria descartando primero las ventanas vencidas y luego las más antiguas", () => {
    const { limite, reloj } = limiteConReloj({ maximo: 1, maxOrigenes: 2 });
    limite.registrarFallo("vencido");
    reloj.ms = VENTANA_MS;
    limite.registrarFallo("a");
    limite.registrarFallo("b");
    expect([limite.bloqueado("a"), limite.bloqueado("b")]).toEqual([true, true]);

    limite.registrarFallo("c");
    expect([limite.bloqueado("a"), limite.bloqueado("b"), limite.bloqueado("c")]).toEqual([false, true, true]);
  });
});

describe("origenDeSolicitud", () => {
  it("prefiere x-real-ip y luego la primera IP de x-forwarded-for", () => {
    expect(origenDeSolicitud(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(origenDeSolicitud(new Headers({ "x-forwarded-for": " 2.2.2.2 , 10.0.0.1" }))).toBe("2.2.2.2");
  });

  it("agrupa las solicitudes sin cabeceras de proxy en un mismo origen", () => {
    expect(origenDeSolicitud(new Headers())).toBe("desconocido");
    expect(origenDeSolicitud(new Headers({ "x-real-ip": " ", "x-forwarded-for": "" }))).toBe("desconocido");
  });
});
