import { cn } from "@/lib/utils";

/**
 * Barra de progreso indeterminada fija bajo el header mientras se actualizan los resultados.
 * La altura del header se toma de `--app-header-height`; por defecto 4.25rem
 * (franja tricolor de 3px + barra h-16 + borde de 1px de `AppHeader`).
 */
export function FetchingBar({ activo }: { activo: boolean }) {
  return (
    <div
      role="progressbar"
      aria-label="Actualizando resultados"
      aria-hidden={!activo}
      className={cn(
        "pointer-events-none fixed inset-x-0 top-[var(--app-header-height,4.25rem)] z-40 h-0.5 overflow-hidden transition-opacity duration-300",
        activo ? "opacity-100" : "opacity-0",
      )}
    >
      {activo && <div className="h-full w-full origin-left animate-progress bg-gold" />}
    </div>
  );
}
