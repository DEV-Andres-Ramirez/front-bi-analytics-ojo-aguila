"use client";

import {
  Building2Icon,
  MapIcon,
  MapPinIcon,
  SearchIcon,
  SearchXIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { getNivel } from "@/domain/niveles";
import { useFiltrosUrl } from "@/hooks/use-filtros-url";
import { useGeografia } from "@/hooks/use-queries";
import { formatCantidad } from "@/lib/format";
import {
  agruparPorNivel,
  buscarLugares,
  indexarLugares,
  LIMITE_RESULTADOS,
  sugerenciasIniciales,
  type Lugar,
  type NivelBusqueda,
} from "./indice-lugares";

type EstadoIndice = "cargando" | "error" | "listo";

const ICONO_NIVEL: Record<NivelBusqueda, LucideIcon> = {
  departamento: MapIcon,
  municipio: Building2Icon,
  puesto: MapPinIcon,
};

const suscripcionVacia = () => () => {};

function useEsMac() {
  return useSyncExternalStore(
    suscripcionVacia,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => true,
  );
}

/** Buscador global de lugares (⌘K / Ctrl+K). El índice geográfico se descarga al abrirlo. */
export function CommandSearch() {
  const [abierto, setAbierto] = useState(false);
  const { eleccion, setCodigo } = useFiltrosUrl();
  const geografia = useGeografia(abierto);
  const esMac = useEsMac();

  const lugares = useMemo(() => (geografia.data ? indexarLugares(geografia.data.items) : []), [geografia.data]);
  const estado: EstadoIndice = geografia.data
    ? "listo"
    : geografia.isError && !geografia.isFetching
      ? "error"
      : "cargando";

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        setAbierto((actual) => !actual);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function seleccionar(lugar: Lugar) {
    setCodigo(lugar.codigo);
    setAbierto(false);
    if (!eleccion) {
      toast.info(`Lugar elegido: ${lugar.nombre}`, {
        description: "Ahora elige la elección en los filtros para ver sus resultados.",
      });
      return;
    }
    // Los resultados del nuevo lugar empiezan arriba: sin esto quedarían fuera de la vista.
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: sinMovimiento ? "auto" : "smooth" });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setAbierto(true)}
        aria-label="Buscar lugar"
        aria-keyshortcuts="Meta+K Control+K"
        className="w-8 px-0 text-muted-foreground hover:text-foreground md:w-44 md:justify-start md:gap-2 md:pr-1.5 md:pl-2.5 lg:w-auto xl:w-48"
      >
        <SearchIcon />
        <span className="hidden md:inline lg:hidden xl:inline">Buscar lugar</span>
        <Kbd className="ml-auto hidden min-w-11 md:inline-flex">{esMac ? "⌘K" : "Ctrl K"}</Kbd>
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent
          showCloseButton={false}
          className="top-[max(1rem,12dvh)] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Buscar lugar</DialogTitle>
            <DialogDescription>
              Busca un departamento, municipio o puesto de votación por nombre o por código. Para un puesto con
              nombre común, agrega el municipio o el departamento.
            </DialogDescription>
          </DialogHeader>
          <PanelBusqueda
            lugares={lugares}
            estado={estado}
            onReintentar={() => geografia.refetch()}
            onSeleccionar={seleccionar}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

interface PanelBusquedaProps {
  lugares: Lugar[];
  estado: EstadoIndice;
  onReintentar: () => void;
  onSeleccionar: (lugar: Lugar) => void;
}

/** Se monta al abrir el diálogo, así que la consulta se reinicia en cada apertura. */
function PanelBusqueda({ lugares, estado, onReintentar, onSeleccionar }: PanelBusquedaProps) {
  const [consulta, setConsulta] = useState("");
  const buscando = consulta.trim() !== "";

  const sugerencias = useMemo(() => sugerenciasIniciales(lugares), [lugares]);
  const resultados = useMemo(
    () => (buscando ? buscarLugares(lugares, consulta) : sugerencias),
    [buscando, lugares, consulta, sugerencias],
  );
  const grupos = useMemo(() => agruparPorNivel(resultados), [resultados]);

  return (
    <Command shouldFilter={false} loop label="Buscar lugar" className="rounded-none! p-0">
      <div className="p-1">
        <CommandInput
          value={consulta}
          onValueChange={setConsulta}
          placeholder="Departamento, municipio, puesto o código…"
        />
      </div>

      <CommandList className="max-h-[min(26rem,60dvh)] px-1 pb-1">
        {estado === "cargando" && (
          <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Spinner aria-hidden />
            Cargando lugares…
          </div>
        )}

        {estado === "error" && (
          <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center text-sm">
            <TriangleAlertIcon aria-hidden className="size-5 text-destructive" />
            <p className="text-muted-foreground">No fue posible cargar el índice de lugares.</p>
            <Button variant="outline" size="sm" onClick={onReintentar}>
              Reintentar
            </Button>
          </div>
        )}

        {estado === "listo" && (
          <>
            <CommandEmpty className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <SearchXIcon aria-hidden className="size-5" />
              {buscando ? (
                <span>
                  Sin resultados para <span className="font-medium text-foreground">“{consulta.trim()}”</span>
                </span>
              ) : (
                <span>No hay lugares disponibles.</span>
              )}
            </CommandEmpty>
            {grupos.map((grupo) => (
              <CommandGroup key={grupo.nivel} heading={getNivel(grupo.nivel).etiquetaPlural}>
                {grupo.lugares.map((lugar) => (
                  <ItemLugar key={lugar.codigo} lugar={lugar} onSeleccionar={onSeleccionar} />
                ))}
              </CommandGroup>
            ))}
          </>
        )}
      </CommandList>

      <PieBusqueda mensaje={estado === "listo" ? mensajeResultados(buscando, resultados.length) : ""} />
    </Command>
  );
}

function mensajeResultados(buscando: boolean, total: number): string {
  if (!buscando) return "Sugerencias: departamentos";
  if (total >= LIMITE_RESULTADOS) return `Primeros ${LIMITE_RESULTADOS} resultados · refina la búsqueda`;
  return formatCantidad(total, "resultado", "resultados");
}

function ItemLugar({ lugar, onSeleccionar }: { lugar: Lugar; onSeleccionar: (lugar: Lugar) => void }) {
  const Icono = ICONO_NIVEL[lugar.nivel];

  return (
    <CommandItem value={lugar.codigo} onSelect={() => onSeleccionar(lugar)} className="gap-3 py-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground transition-colors group-data-selected/command-item:border-gold/60 group-data-selected/command-item:bg-gold/15">
        <Icono aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{lugar.nombre}</span>
        <span className="truncate text-xs text-muted-foreground">{lugar.contexto}</span>
      </span>
      <CommandShortcut className="font-mono tracking-normal tabular-nums">{lugar.codigo}</CommandShortcut>
    </CommandItem>
  );
}

function PieBusqueda({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
      <span className="hidden items-center gap-1.5 sm:flex">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        <span className="mr-2">navegar</span>
        <Kbd>↵</Kbd>
        <span className="mr-2">ir al lugar</span>
        <Kbd>Esc</Kbd>
        <span>cerrar</span>
      </span>
      <span aria-live="polite" className="ml-auto tabular-nums">
        {mensaje}
      </span>
    </div>
  );
}
