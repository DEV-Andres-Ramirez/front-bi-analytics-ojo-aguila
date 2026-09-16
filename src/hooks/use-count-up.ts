"use client";

import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * Anima un número desde su valor anterior hasta `objetivo` (desde 0 en el primer render).
 * Con `prefers-reduced-motion` salta directamente al valor final.
 */
export function useCountUp(objetivo: number, duracionMs = 700): number {
  const [valor, setValor] = useState(0);
  const valorActual = useRef(0);

  useEffect(() => {
    const desde = valorActual.current;
    if (desde === objetivo) return;

    const sinMovimiento = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    let inicio: number | null = null;
    let frame = 0;

    const avanzar = (ahora: number) => {
      inicio ??= ahora;
      const progreso = sinMovimiento ? 1 : Math.min((ahora - inicio) / duracionMs, 1);
      const siguiente = progreso === 1 ? objetivo : desde + (objetivo - desde) * easeOutCubic(progreso);
      valorActual.current = siguiente;
      setValor(siguiente);
      if (progreso < 1) frame = requestAnimationFrame(avanzar);
    };

    frame = requestAnimationFrame(avanzar);
    return () => cancelAnimationFrame(frame);
  }, [objetivo, duracionMs]);

  return Math.round(valor);
}
