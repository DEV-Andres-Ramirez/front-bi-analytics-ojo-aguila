"use client";

import { ArrowUpIcon, CheckIcon, LockIcon, MapPinIcon } from "lucide-react";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NIVELES } from "@/domain/niveles";
import type { NivelId, UnidadGeografica } from "@/domain/types";
import { cn } from "@/lib/utils";

const NIVELES_HABILITADOS = NIVELES.filter((nivel) => nivel.habilitado);
const NIVEL_MESA = NIVELES.find((nivel) => !nivel.habilitado);

type EstadoNivel = "completado" | "actual" | "pendiente";

function NivelPill({ etiqueta, estado }: { etiqueta: string; estado: EstadoNivel }) {
  return (
    <li
      aria-current={estado === "actual" ? "step" : undefined}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors duration-300",
        estado === "completado" && "border-gold/40 bg-gold/10 text-foreground",
        estado === "actual" && "border-transparent bg-gold text-gold-foreground shadow-sm",
        estado === "pendiente" && "border-dashed text-muted-foreground",
      )}
    >
      {estado === "completado" && <CheckIcon aria-hidden className="size-3" />}
      {etiqueta}
      <span className="sr-only">
        {estado === "completado" ? " (recorrido)" : estado === "actual" ? " (nivel actual)" : " (pendiente)"}
      </span>
    </li>
  );
}

function NivelesPills({ nivelActual }: { nivelActual: NivelId }) {
  const indiceActual = NIVELES_HABILITADOS.findIndex((nivel) => nivel.id === nivelActual);

  return (
    <ol aria-label="Niveles de detalle" className="flex flex-wrap items-center gap-1.5">
      {NIVELES_HABILITADOS.map((nivel, index) => (
        <NivelPill
          key={nivel.id}
          etiqueta={nivel.etiqueta}
          estado={index < indiceActual ? "completado" : index === indiceActual ? "actual" : "pendiente"}
        />
      ))}
      {NIVEL_MESA && (
        <li>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                aria-disabled="true"
                className="inline-flex h-6 cursor-not-allowed items-center gap-1 rounded-full border border-dashed px-2.5 text-xs font-medium text-muted-foreground/70 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <LockIcon aria-hidden className="size-3" />
                {NIVEL_MESA.etiqueta}
                <span className="sr-only"> (no disponible)</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>Disponible cuando la fuente incluya el número de mesa</TooltipContent>
          </Tooltip>
        </li>
      )}
    </ol>
  );
}

interface GeoBreadcrumbProps {
  /** Ruta desde Colombia hasta el ámbito actual (incluido). */
  ruta: UnidadGeografica[];
  onNavegar: (codigo: string) => void;
}

export function GeoBreadcrumb({ ruta, onNavegar }: GeoBreadcrumbProps) {
  const actual = ruta[ruta.length - 1];
  const padre = ruta.length > 1 ? ruta[ruta.length - 2] : null;
  if (!actual) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/60 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <Breadcrumb aria-label="Ruta geográfica" className="min-w-0">
          <BreadcrumbList>
            {ruta.map((unidad, index) => {
              const esUltimo = index === ruta.length - 1;
              const contenido = (
                <>
                  {index === 0 && <MapPinIcon aria-hidden className="size-3.5 text-gold" />}
                  {unidad.nombre}
                </>
              );
              return (
                <Fragment key={unidad.codigo || "colombia"}>
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {esUltimo ? (
                      <BreadcrumbPage className="inline-flex items-center gap-1 font-medium">{contenido}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <button
                          type="button"
                          onClick={() => onNavegar(unidad.codigo)}
                          className="inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          {contenido}
                        </button>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
        <NivelesPills nivelActual={actual.nivel} />
        {padre && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavegar(padre.codigo)}
            title={`Volver a ${padre.nombre}`}
            className="shrink-0"
          >
            <ArrowUpIcon aria-hidden />
            Subir un nivel
          </Button>
        )}
      </div>
    </div>
  );
}
