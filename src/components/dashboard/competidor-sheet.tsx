"use client";

import { ChevronRightIcon, TrendingDownIcon, TrendingUpIcon, TrophyIcon, XIcon, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { DesempenoCompetidorChart } from "@/components/charts/lazy";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Competidor, DetalleCompetidorResponse, ResultadosResponse } from "@/domain/types";
import type { ColoresCompetidores } from "@/hooks/use-colores-competidores";
import { useDetalleCompetidor } from "@/hooks/use-queries";
import { formatCantidad, formatNumero, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BarraProporcion } from "./competidor-color";
import { ETIQUETA_DIMENSION, etiquetasNivel } from "./etiquetas";
import { QueryError } from "./query-error";

const TOP_UNIDADES = 5;

type UnidadDesempeno = DetalleCompetidorResponse["unidades"][number];
type MetricaGrafica = "votos" | "pct";

interface CabeceraCompetidorProps {
  competidor: Competidor;
  color: string;
  response: ResultadosResponse;
}

function CabeceraCompetidor({ competidor, color, response }: CabeceraCompetidorProps) {
  return (
    <div className="shrink-0 border-b">
      <div aria-hidden className="h-1.5 w-full" style={{ backgroundColor: color }} />
      <SheetHeader className="gap-1 px-5 pt-4 pb-5">
        <p className="pr-8 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {ETIQUETA_DIMENSION[response.dimension].titulo} · {response.ambito.unidad.nombre}
        </p>
        <SheetTitle className="pr-8 font-heading text-xl leading-tight font-bold text-balance">{competidor.nombre}</SheetTitle>
        <SheetDescription className={cn(!competidor.detalle && "sr-only")}>
          {competidor.detalle || `Desempeño del ${ETIQUETA_DIMENSION[response.dimension].singular} en el ámbito`}
        </SheetDescription>
        <dl className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/60 px-3 py-2">
            <dt className="text-xs text-muted-foreground">Votos</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatNumero(competidor.votos)}</dd>
          </div>
          <div className="rounded-lg bg-muted/60 px-3 py-2">
            <dt className="truncate text-xs text-muted-foreground">% de válidos en el ámbito</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatPct(competidor.pctValidos)}</dd>
          </div>
        </dl>
      </SheetHeader>
    </div>
  );
}

function MetricaResumen({ icono: Icono, etiqueta, valor }: { icono: LucideIcon; etiqueta: string; valor: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-lg border p-3">
      <Icono aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{etiqueta}</p>
        <p className="line-clamp-2 text-sm font-semibold break-words">{valor}</p>
      </div>
    </div>
  );
}

interface ListaUnidadesProps {
  titulo: string;
  unidades: UnidadDesempeno[];
  color: string;
  onSelect: (codigo: string) => void;
}

function ListaUnidades({ titulo, unidades, color, onSelect }: ListaUnidadesProps) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{titulo}</h3>
      <ol className="flex flex-col gap-1">
        {unidades.map((item) => (
          <li key={item.unidad.codigo}>
            <button
              type="button"
              onClick={() => onSelect(item.unidad.codigo)}
              className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sm font-medium">{item.unidad.nombre}</span>
                <BarraProporcion ratio={item.pct} color={color} className="w-full" />
              </span>
              <span className="flex flex-col items-end text-xs">
                <span className="font-semibold tabular-nums">{formatPct(item.pct)}</span>
                <span className="text-muted-foreground tabular-nums">
                  {item.posicion === null ? "—" : `#${item.posicion}`}
                </span>
              </span>
              <ChevronRightIcon
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface DetalleContenidoProps {
  detalle: DetalleCompetidorResponse;
  color: string;
  totalUnidades: number;
  onSelectUnidad: (codigo: string) => void;
}

function DetalleContenido({ detalle, color, totalUnidades, onSelectUnidad }: DetalleContenidoProps) {
  const [metrica, setMetrica] = useState<MetricaGrafica>("votos");
  const { ambito, competidor, unidades } = detalle;

  if (!ambito.nivelHijos || unidades.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Este ámbito no tiene subdivisiones con votos para mostrar el desempeño territorial.
      </p>
    );
  }

  const nivel = etiquetasNivel(ambito.nivelHijos);
  const porParticipacion = [...unidades].sort((a, b) => b.pct - a.pct);
  const fortalezas = porParticipacion.slice(0, TOP_UNIDADES);
  const debilidades = porParticipacion.slice(Math.max(TOP_UNIDADES, porParticipacion.length - TOP_UNIDADES)).reverse();
  const mejor = porParticipacion[0];
  const peor = porParticipacion[porParticipacion.length - 1];
  const victorias = unidades.filter((item) => item.posicion === 1).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Desempeño por {nivel.singular}</h3>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={metrica}
            onValueChange={(valor) => {
              if (valor === "votos" || valor === "pct") setMetrica(valor);
            }}
            aria-label="Métrica de la gráfica"
          >
            <ToggleGroupItem value="votos">Votos</ToggleGroupItem>
            <ToggleGroupItem value="pct">%</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="h-[360px]">
          <DesempenoCompetidorChart
            competidor={competidor}
            color={color}
            unidades={unidades}
            metrica={metrica}
            onSelectUnidad={onSelectUnidad}
          />
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricaResumen
          icono={TrophyIcon}
          etiqueta="Victorias"
          valor={`Gana en ${formatNumero(victorias)} de ${formatCantidad(totalUnidades, nivel.singular, nivel.plural)}`}
        />
        <MetricaResumen
          icono={TrendingUpIcon}
          etiqueta={`Mejor ${nivel.singular}`}
          valor={`${mejor.unidad.nombre} (${formatPct(mejor.pct)})`}
        />
        <MetricaResumen icono={TrendingDownIcon} etiqueta="Más débil" valor={`${peor.unidad.nombre} (${formatPct(peor.pct)})`} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <ListaUnidades
          titulo="Fortalezas"
          unidades={fortalezas}
          color={color}
          onSelect={onSelectUnidad}
        />
        {debilidades.length > 0 && (
          <ListaUnidades
            titulo="Debilidades"
            unidades={debilidades}
            color={color}
            onSelect={onSelectUnidad}
          />
        )}
      </div>
    </div>
  );
}

function DetalleSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Cargando detalle…</span>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-24" />
      </div>
      <Skeleton className="h-[360px] w-full rounded-lg" />
      <div className="grid gap-2 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-16 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            {Array.from({ length: TOP_UNIDADES }, (_, fila) => (
              <Skeleton key={fila} className="h-10 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface CompetidorSheetProps {
  response: ResultadosResponse;
  colores: ColoresCompetidores;
  competidorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Destino del foco al cerrar (el panel se abre sin disparador propio). */
  onCloseAutoFocus: (evento: Event) => void;
  onNavegar: (codigo: string) => void;
}

export function CompetidorSheet({
  response,
  colores,
  competidorId,
  open,
  onOpenChange,
  onCloseAutoFocus,
  onNavegar,
}: CompetidorSheetProps) {
  const detalle = useDetalleCompetidor(
    response.eleccion,
    response.ambito.unidad.codigo,
    response.dimension,
    competidorId,
  );
  const competidor = response.competidores.find((c) => c.id === competidorId) ?? detalle.data?.competidor;

  const irAUnidad = (codigo: string) => {
    onOpenChange(false);
    onNavegar(codigo);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        {competidor ? (
          <CabeceraCompetidor competidor={competidor} color={colores.competidor(competidor.id)} response={response} />
        ) : (
          <SheetHeader className="gap-2 border-b px-5 py-5">
            <SheetTitle className="sr-only">Detalle del competidor</SheetTitle>
            <SheetDescription className="sr-only">Cargando la información del competidor</SheetDescription>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </SheetHeader>
        )}

        <SheetClose asChild>
          <Button variant="ghost" size="icon-sm" className="absolute top-4 right-3" aria-label="Cerrar detalle">
            <XIcon />
          </Button>
        </SheetClose>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {detalle.isPending ? (
            <DetalleSkeleton />
          ) : detalle.isError ? (
            <QueryError
              titulo="No pudimos cargar el detalle"
              error={detalle.error}
              onRetry={() => void detalle.refetch()}
              reintentando={detalle.isFetching}
            />
          ) : (
            <DetalleContenido
              key={detalle.data.competidor.id}
              detalle={detalle.data}
              color={colores.competidor(detalle.data.competidor.id)}
              totalUnidades={detalle.data.unidades.length}
              onSelectUnidad={irAUnidad}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
