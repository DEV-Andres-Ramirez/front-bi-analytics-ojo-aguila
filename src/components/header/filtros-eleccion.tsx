"use client";

import { CheckIcon, ChevronRightIcon, RotateCcwIcon } from "lucide-react";
import { useId, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Catalogo } from "@/domain/types";
import { formatEtiquetaCatalogo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TOTAL_PASOS } from "./seleccion-eleccion";
import { useSeleccionEleccion } from "./use-seleccion-eleccion";

type Orientacion = "horizontal" | "vertical";
type EstadoPaso = "completo" | "activo" | "pendiente";

const PLACEHOLDER = "Elegir";

/** Ancho fijo por paso en el header: el cambio de valor no desplaza el layout. */
const ANCHO_HORIZONTAL = ["w-32", "w-36", "w-20"] as const;

interface Paso {
  etiqueta: string;
  opciones: string[];
  valor: string | null;
  onChange: (valor: string) => void;
  /** Motivo por el que el paso no está disponible, o null si lo está. */
  bloqueo: string | null;
}

interface FiltrosEleccionProps {
  catalogo: Catalogo;
  orientation?: Orientacion;
  className?: string;
}

/** Stepper Tipificación → Corporación → Año sincronizado con la URL. */
export function FiltrosEleccion({ catalogo, orientation = "horizontal", className }: FiltrosEleccionProps) {
  const { seleccion, setTipificacion, setCorporacion, setPeriodo, limpiar } = useSeleccionEleccion(catalogo);
  const baseId = useId();
  const vertical = orientation === "vertical";

  const pasos: Paso[] = [
    {
      etiqueta: "Tipificación",
      opciones: catalogo.map((t) => t.tipificacion),
      valor: seleccion.tipificacion,
      onChange: setTipificacion,
      bloqueo: null,
    },
    {
      etiqueta: "Corporación",
      opciones: seleccion.corporaciones,
      valor: seleccion.corporacion,
      onChange: setCorporacion,
      bloqueo: seleccion.tipificacion ? null : "Selecciona primero la tipificación",
    },
    {
      etiqueta: "Año",
      opciones: seleccion.periodos,
      valor: seleccion.periodo,
      onChange: setPeriodo,
      bloqueo: seleccion.corporacion ? null : "Selecciona primero la corporación",
    },
  ];
  const indiceActivo = pasos.findIndex((paso) => paso.valor === null);
  const haySeleccion = seleccion.tipificacion !== null;

  function handleLimpiar() {
    limpiar();
    document.getElementById(`${baseId}-0`)?.focus();
  }

  return (
    <div className={cn("flex", vertical ? "flex-col gap-5" : "items-center gap-2", className)}>
      <ol aria-label="Filtros de elección" className={cn("flex", vertical ? "flex-col" : "items-center gap-2")}>
        {pasos.map((paso, index) => (
          <PasoFiltro
            key={paso.etiqueta}
            id={`${baseId}-${index}`}
            numero={index + 1}
            paso={paso}
            estado={paso.valor !== null ? "completo" : index === indiceActivo ? "activo" : "pendiente"}
            orientation={orientation}
          />
        ))}
      </ol>

      {vertical ? (
        haySeleccion && (
          <Button variant="ghost" size="sm" onClick={handleLimpiar} className="self-start text-muted-foreground">
            <RotateCcwIcon />
            Limpiar filtros
          </Button>
        )
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLimpiar}
              disabled={!haySeleccion}
              aria-label="Limpiar filtros"
              className={cn(
                "text-muted-foreground transition-[color,background-color,opacity,visibility] duration-200 hover:text-foreground",
                !haySeleccion && "invisible opacity-0",
              )}
            >
              <RotateCcwIcon />
              <span className="hidden xl:inline">Limpiar</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Limpiar filtros</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

interface PasoFiltroProps {
  id: string;
  numero: number;
  paso: Paso;
  estado: EstadoPaso;
  orientation: Orientacion;
}

function PasoFiltro({ id, numero, paso, estado, orientation }: PasoFiltroProps) {
  const vertical = orientation === "vertical";
  const selectorProps: SelectorProps = {
    id,
    size: vertical ? "default" : "sm",
    className: vertical ? "w-full data-[size=default]:h-10" : ANCHO_HORIZONTAL[numero - 1],
  };

  const selector = (
    <div className="relative">
      {paso.bloqueo ? (
        <SelectorBloqueado {...selectorProps} motivo={paso.bloqueo} motivoVisible={vertical} />
      ) : (
        <SelectorPaso {...selectorProps} opciones={paso.opciones} valor={paso.valor} onChange={paso.onChange} />
      )}
      {estado === "activo" && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-[calc(var(--radius-md)_+_4px)] ring-2 ring-gold/60 motion-safe:animate-pulse"
        />
      )}
    </div>
  );

  const etiqueta = (
    <Label
      htmlFor={id}
      className={vertical ? undefined : "text-[0.65rem] tracking-wider text-muted-foreground uppercase"}
    >
      {paso.etiqueta}
      <span className="sr-only">
        {`, paso ${numero} de ${TOTAL_PASOS}${estado === "completo" ? ", completado" : ""}`}
      </span>
    </Label>
  );

  if (vertical) {
    return (
      <li aria-current={estado === "activo" ? "step" : undefined} className="relative flex gap-3 pb-6 last:pb-0">
        {numero < TOTAL_PASOS && (
          <span
            aria-hidden
            className={cn(
              "absolute top-8 bottom-2 left-3 w-px -translate-x-1/2 transition-colors duration-300",
              estado === "completo" ? "bg-gold" : "bg-border",
            )}
          />
        )}
        <IndicadorPaso numero={numero} estado={estado} />
        <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
          {etiqueta}
          {selector}
        </div>
      </li>
    );
  }

  return (
    <li aria-current={estado === "activo" ? "step" : undefined} className="flex items-center gap-2">
      {numero > 1 && (
        <ChevronRightIcon
          aria-hidden
          className={cn(
            "size-4 shrink-0 transition-colors duration-300",
            estado === "pendiente" ? "text-muted-foreground/50" : "text-gold",
          )}
        />
      )}
      <IndicadorPaso numero={numero} estado={estado} />
      <div className="flex flex-col gap-1">
        {etiqueta}
        {selector}
      </div>
    </li>
  );
}

function IndicadorPaso({ numero, estado }: { numero: number; estado: EstadoPaso }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.7rem] font-semibold tabular-nums transition-[color,background-color,border-color,box-shadow] duration-300",
        estado === "completo" && "border-gold bg-gold text-gold-foreground",
        estado === "activo" && "border-gold bg-background text-foreground ring-4 ring-gold/20",
        estado === "pendiente" && "border-border bg-background text-muted-foreground",
      )}
    >
      {estado === "completo" ? (
        <CheckIcon strokeWidth={3} className="size-3.5 animate-in duration-300 fade-in zoom-in-50" />
      ) : (
        numero
      )}
    </span>
  );
}

interface SelectorProps {
  id: string;
  size: "sm" | "default";
  className: string;
}

interface SelectorPasoProps extends SelectorProps {
  opciones: string[];
  valor: string | null;
  onChange: (valor: string) => void;
}

function SelectorPaso({ id, size, className, opciones, valor, onChange }: SelectorPasoProps) {
  return (
    <Select
      value={valor ?? ""}
      onValueChange={(nuevo) => {
        if (nuevo) onChange(nuevo);
      }}
    >
      <SelectTrigger id={id} size={size} className={className}>
        <SelectValue placeholder={PLACEHOLDER}>{valor ? formatEtiquetaCatalogo(valor) : undefined}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        {opciones.map((opcion) => (
          <SelectItem key={opcion} value={opcion}>
            {formatEtiquetaCatalogo(opcion)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface SelectorBloqueadoProps extends SelectorProps {
  motivo: string;
  /** Muestra el motivo como texto bajo el selector (útil en táctil, donde no hay hover). */
  motivoVisible: boolean;
}

/**
 * Paso aún no disponible. Usa `aria-disabled` en lugar de `disabled` para que siga siendo
 * enfocable y anuncie el motivo; al intentar abrirlo se muestra el tooltip explicativo.
 */
function SelectorBloqueado({ id, size, className, motivo, motivoVisible }: SelectorBloqueadoProps) {
  const [ayudaVisible, setAyudaVisible] = useState(false);
  const motivoId = `${id}-motivo`;

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    setAyudaVisible(true);
  }

  return (
    <>
      <Select value="" open={false} onOpenChange={setAyudaVisible}>
        <Tooltip open={ayudaVisible} onOpenChange={setAyudaVisible}>
          <TooltipTrigger asChild>
            <SelectTrigger
              id={id}
              size={size}
              aria-disabled
              aria-describedby={motivoId}
              onClick={handleClick}
              className={cn(className, "cursor-not-allowed opacity-50")}
            >
              <SelectValue placeholder={PLACEHOLDER} />
            </SelectTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{motivo}</TooltipContent>
        </Tooltip>
      </Select>
      <p id={motivoId} className={motivoVisible ? "mt-1.5 text-xs text-muted-foreground" : "sr-only"}>
        {motivo}
      </p>
    </>
  );
}

/** Placeholder del stepper horizontal con las mismas dimensiones. */
export function FiltrosEleccionSkeleton() {
  return (
    <div aria-hidden className="flex items-center gap-2">
      {ANCHO_HORIZONTAL.map((ancho, index) => (
        <div key={ancho} className="flex items-center gap-2">
          {index > 0 && <ChevronRightIcon className="size-4 text-muted-foreground/30" />}
          <Skeleton className="size-6 rounded-full" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className={cn("h-7", ancho)} />
          </div>
        </div>
      ))}
    </div>
  );
}
