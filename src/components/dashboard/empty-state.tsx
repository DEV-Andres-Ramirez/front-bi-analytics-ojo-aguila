"use client";

import {
  CalendarDaysIcon,
  CheckIcon,
  LandmarkIcon,
  MapPinIcon,
  SearchXIcon,
  VoteIcon,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { LogoMark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { nivelDeCodigo } from "@/domain/niveles";
import type { Catalogo, EleccionRef } from "@/domain/types";
import { useGeografia } from "@/hooks/use-queries";
import { formatCantidad, formatEtiquetaCatalogo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { etiquetaEleccion } from "./etiquetas";

interface Paso {
  titulo: string;
  icono: LucideIcon;
  valor: string | null;
}

function resumenCatalogo(catalogo: Catalogo) {
  const periodos = catalogo.flatMap((t) => t.corporaciones.flatMap((c) => c.periodos));
  const anios = [...new Set(periodos)].sort();
  const tipificaciones = new Intl.ListFormat("es-CO", { type: "conjunction" }).format(
    catalogo.map((t) => formatEtiquetaCatalogo(t.tipificacion)),
  );
  return { elecciones: periodos.length, anios, tipificaciones };
}

function PasoItem({ paso, numero, esSiguiente }: { paso: Paso; numero: number; esSiguiente: boolean }) {
  const completado = paso.valor !== null;
  const Icono = paso.icono;

  return (
    <li
      aria-current={esSiguiente ? "step" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all duration-300",
        completado && "border-gold/50 bg-gold/5",
        esSiguiente && "ring-2 ring-gold/40",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-colors",
          completado ? "border-transparent bg-gold text-gold-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {completado ? <CheckIcon className="size-4 animate-in zoom-in-50" /> : numero}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Icono aria-hidden className="size-3.5 text-muted-foreground" />
          {paso.titulo}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {completado ? (
            <>
              <span className="sr-only">Seleccionado: </span>
              {paso.valor}
            </>
          ) : esSiguiente ? (
            "Selecciona en el encabezado"
          ) : (
            "Pendiente"
          )}
        </span>
      </span>
    </li>
  );
}

/**
 * Lugar ya elegido (⌘K o enlace) mientras falta la elección. El nombre sale del índice del buscador
 * si ya está en caché; no se descarga solo para esto.
 */
function LugarElegido({ codigo }: { codigo: string }) {
  const geografia = useGeografia(false);
  const nombre = useMemo(
    () => geografia.data?.items.find(([codigoLugar]) => codigoLugar === codigo)?.[1],
    [geografia.data, codigo],
  );

  return (
    <p className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-sm">
      <MapPinIcon aria-hidden className="size-3.5 shrink-0 text-gold" />
      <span className="truncate">
        Lugar elegido: <span className="font-medium">{nombre ?? codigo}</span>
      </span>
      <span className="shrink-0 text-muted-foreground">· {nivelDeCodigo(codigo).etiqueta}</span>
    </p>
  );
}

interface EmptyStateProps {
  catalogo: Catalogo;
  tipificacion: string | null;
  corporacion: string | null;
  periodo: string | null;
  /** Ámbito geográfico de la URL ("" = Colombia); se conserva al elegir la elección. */
  codigo: string;
}

/** Estado inicial guiado: refleja en vivo los filtros elegidos en el header. */
export function EmptyState({ catalogo, tipificacion, corporacion, periodo, codigo }: EmptyStateProps) {
  const pasos: Paso[] = [
    { titulo: "Tipificación", icono: VoteIcon, valor: tipificacion ? formatEtiquetaCatalogo(tipificacion) : null },
    { titulo: "Corporación", icono: LandmarkIcon, valor: corporacion ? formatEtiquetaCatalogo(corporacion) : null },
    { titulo: "Año", icono: CalendarDaysIcon, valor: periodo || null },
  ];
  const siguiente = pasos.findIndex((paso) => paso.valor === null);
  const { elecciones, anios, tipificaciones } = resumenCatalogo(catalogo);

  return (
    <section
      aria-labelledby="empty-state-titulo"
      className="relative isolate flex flex-1 flex-col items-center justify-center overflow-hidden rounded-3xl border bg-card/40 px-4 py-12 text-center sm:px-8 sm:py-16"
    >
      <div
        aria-hidden
        className="bg-grid-pattern absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
      />
      <div className="flex max-w-2xl flex-col items-center gap-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="relative animate-float">
          <div aria-hidden className="absolute -inset-6 -z-10 rounded-full bg-gold/20 blur-2xl" />
          <LogoMark size={88} priority />
        </div>
        <div className="flex flex-col gap-2">
          <h1 id="empty-state-titulo" className="font-heading text-2xl font-bold tracking-tight text-balance sm:text-4xl">
            Explora los resultados electorales de <span className="text-gold-gradient">Colombia</span>
          </h1>
          <p className="text-sm text-balance text-muted-foreground sm:text-base">
            Elige la elección en los filtros del encabezado. Verás los resultados desde el nivel nacional hasta el
            puesto de votación.
          </p>
        </div>

        {codigo && <LugarElegido codigo={codigo} />}

        <ol aria-label="Pasos para elegir una elección" className="grid w-full gap-2 sm:grid-cols-3">
          {pasos.map((paso, index) => (
            <PasoItem key={paso.titulo} paso={paso} numero={index + 1} esSiguiente={index === siguiente} />
          ))}
        </ol>

        <ul aria-label="Datos disponibles" className="flex flex-wrap justify-center gap-2">
          <li>
            <Badge variant="outline" className="h-6 px-2.5 tabular-nums">
              {formatCantidad(elecciones, "elección disponible", "elecciones disponibles")}
            </Badge>
          </li>
          {anios.length > 0 && (
            <li>
              <Badge variant="outline" className="h-6 px-2.5 tabular-nums">
                {formatCantidad(anios.length, "año", "años")} · {anios[0]}
                {anios.length > 1 && `–${anios[anios.length - 1]}`}
              </Badge>
            </li>
          )}
          {tipificaciones && (
            <li>
              <Badge variant="outline" className="h-6 px-2.5">
                {tipificaciones}
              </Badge>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

interface EleccionNoDisponibleProps {
  eleccion: EleccionRef;
  onLimpiar: () => void;
}

export function EleccionNoDisponible({ eleccion, onLimpiar }: EleccionNoDisponibleProps) {
  return (
    <Empty className="flex-1 border py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-11 rounded-xl">
          <SearchXIcon className="size-5" />
        </EmptyMedia>
        <EmptyTitle className="text-lg">Elección no disponible</EmptyTitle>
        <EmptyDescription>
          La combinación <span className="font-medium text-foreground">{etiquetaEleccion(eleccion)}</span> no existe en
          los datos cargados. Revisa el enlace o elige otra elección.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onLimpiar}>Limpiar filtros</Button>
      </EmptyContent>
    </Empty>
  );
}
