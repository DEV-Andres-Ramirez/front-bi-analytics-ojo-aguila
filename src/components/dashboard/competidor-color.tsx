import { cn } from "@/lib/utils";

/** Neutro de la UI para lo que no tiene ganador (empates). */
export const COLOR_EMPATE = "var(--muted-foreground)";

interface CompetidorDotProps {
  /** Color resuelto con `useColoresCompetidores`. */
  color: string;
  className?: string;
}

/** Punto de color del competidor (decorativo: el nombre siempre acompaña). */
export function CompetidorDot({ color, className }: CompetidorDotProps) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full ring-2 ring-background", className)}
      style={{ backgroundColor: color }}
    />
  );
}

interface BarraProporcionProps {
  /** Proporción 0..1. */
  ratio: number;
  color: string;
  className?: string;
}

/** Mini barra horizontal para acompañar un porcentaje en tablas y listas. */
export function BarraProporcion({ ratio, color, className }: BarraProporcionProps) {
  const ancho = `${Math.min(Math.max(ratio, 0), 1) * 100}%`;
  return (
    <span aria-hidden className={cn("block h-1.5 w-16 overflow-hidden rounded-full bg-muted", className)}>
      <span
        className="block h-full rounded-full transition-[width] duration-500"
        style={{ width: ancho, backgroundColor: color }}
      />
    </span>
  );
}
