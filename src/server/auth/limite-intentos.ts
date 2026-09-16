/**
 * Límite de intentos fallidos por origen (IP), en memoria del proceso. Cada instancia serverless
 * lleva su propia cuenta: es un freno local que complementa la regla de rate limit del firewall.
 */
export interface LimiteIntentos {
  /** true si el origen agotó sus intentos y su ventana sigue vigente. */
  bloqueado(origen: string): boolean;
  registrarFallo(origen: string): void;
  reiniciar(origen: string): void;
}

interface OpcionesLimite {
  maximo: number;
  ventanaMs: number;
  /** Orígenes recordados como máximo: acota la memoria ante muchas IPs distintas. */
  maxOrigenes?: number;
  ahora?: () => number;
}

interface Registro {
  fallos: number;
  /** Inicio de la ventana: momento del primer fallo. */
  inicio: number;
}

export function crearLimiteIntentos({
  maximo,
  ventanaMs,
  maxOrigenes = 10_000,
  ahora = Date.now,
}: OpcionesLimite): LimiteIntentos {
  const registros = new Map<string, Registro>();
  const vencido = (registro: Registro) => ahora() - registro.inicio >= ventanaMs;

  function vigente(origen: string): Registro | undefined {
    const registro = registros.get(origen);
    if (registro && vencido(registro)) {
      registros.delete(origen);
      return undefined;
    }
    return registro;
  }

  /** Elimina las ventanas vencidas y, si aún sobran, las más antiguas (el Map conserva el orden de inserción). */
  function podar() {
    for (const [origen, registro] of registros) {
      if (vencido(registro)) registros.delete(origen);
    }
    for (const origen of registros.keys()) {
      if (registros.size <= maxOrigenes) break;
      registros.delete(origen);
    }
  }

  return {
    bloqueado: (origen) => (vigente(origen)?.fallos ?? 0) >= maximo,
    registrarFallo(origen) {
      const registro = vigente(origen);
      if (registro) {
        registro.fallos += 1;
        return;
      }
      registros.set(origen, { fallos: 1, inicio: ahora() });
      if (registros.size > maxOrigenes) podar();
    },
    reiniciar(origen) {
      registros.delete(origen);
    },
  };
}

const ORIGEN_DESCONOCIDO = "desconocido";

/**
 * IP del cliente según las cabeceras del proxy (en Vercel, `x-real-ip` y `x-forwarded-for` las fija
 * la plataforma). Sin proxy de confianza delante, un cliente podría falsearlas.
 */
export function origenDeSolicitud(cabeceras: Pick<Headers, "get">): string {
  const ipReal = cabeceras.get("x-real-ip")?.trim();
  const reenviada = cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ipReal || reenviada || ORIGEN_DESCONOCIDO;
}
