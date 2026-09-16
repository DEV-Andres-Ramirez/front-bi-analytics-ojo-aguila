import type { ComponentProps, ReactNode } from "react";
import { ChartNoAxesColumn, type LucideIcon } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

interface ChartFrameProps extends ComponentProps<"div"> {
  /** Resumen textual de la gráfica para lectores de pantalla. */
  etiqueta: string;
  /** Dato resaltado con el teclado; se anuncia en una región viva (ver `useChartInteraction`). */
  anuncio?: string;
}

/**
 * Contenedor accesible del canvas: ocupa todo el espacio disponible del padre. Una gráfica estática
 * es una imagen con su resumen; una navegable es un grupo que anuncia el dato activo.
 */
export function ChartFrame({ etiqueta, anuncio, className, children, ...props }: ChartFrameProps) {
  const navegable = anuncio !== undefined;
  return (
    <div
      role={navegable ? "group" : "img"}
      aria-roledescription={navegable ? "gráfica" : undefined}
      aria-label={etiqueta}
      className={cn(
        "relative size-full min-h-0 touch-pan-y rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      {children}
      {navegable && (
        <span aria-live="polite" className="sr-only">
          {anuncio}
        </span>
      )}
    </div>
  );
}

interface ChartVacioProps {
  titulo?: string;
  descripcion?: string;
  icono?: LucideIcon;
  className?: string;
}

export function ChartVacio({
  titulo = "Sin datos para graficar",
  descripcion = "No hay resultados para el ámbito y los filtros seleccionados.",
  icono: Icono = ChartNoAxesColumn,
  className,
}: ChartVacioProps) {
  return (
    <Empty className={cn("size-full min-h-40 gap-2 p-4", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="text-muted-foreground">
          <Icono aria-hidden />
        </EmptyMedia>
        <EmptyTitle>{titulo}</EmptyTitle>
        <EmptyDescription className="text-xs">{descripcion}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

interface MuestraColorProps {
  color: string;
  className?: string;
}

/** Muestra de color de una serie: rectángulo, como las barras que representa. */
export function MuestraColor({ color, className }: MuestraColorProps) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-[3px]", className)}
      style={{ backgroundColor: color }}
    />
  );
}

export function Leyenda({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

interface LeyendaItemProps extends Omit<ComponentProps<"li">, "children"> {
  color: string;
  etiqueta: ReactNode;
  valor?: ReactNode;
}

export function LeyendaItem({ color, etiqueta, valor, className, ...props }: LeyendaItemProps) {
  return (
    <li className={cn("flex min-w-0 items-center gap-1.5", className)} {...props}>
      <MuestraColor color={color} />
      <span className="truncate">{etiqueta}</span>
      {valor !== undefined && (
        <span className="ml-auto shrink-0 pl-2 font-medium text-foreground tabular-nums">{valor}</span>
      )}
    </li>
  );
}
