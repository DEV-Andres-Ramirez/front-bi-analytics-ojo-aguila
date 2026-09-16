"use client";

import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, XIcon } from "lucide-react";
import type { KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatNumero } from "@/lib/format";
import { cn } from "@/lib/utils";

interface TableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}

export function TableSearch({ value, onChange, placeholder, label, className }: TableSearchProps) {
  return (
    <InputGroup className={cn("w-full sm:w-64", className)}>
      <InputGroupAddon>
        <SearchIcon aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="[&::-webkit-search-cancel-button]:appearance-none"
        autoComplete="off"
        spellCheck={false}
      />
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label="Limpiar búsqueda" onClick={() => onChange("")}>
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

interface TablePaginationProps {
  pagina: number;
  totalPaginas: number;
  total: number;
  desde: number;
  hasta: number;
  onPaginaChange: (pagina: number) => void;
}

export function TablePagination({ pagina, totalPaginas, total, desde, hasta, onPaginaChange }: TablePaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <p aria-live="polite" className="tabular-nums">
        {total === 0 ? "Sin resultados" : `${formatNumero(desde)}–${formatNumero(hasta)} de ${formatNumero(total)}`}
      </p>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPaginaChange(pagina - 1)}
            disabled={pagina === 0}
            aria-label="Página anterior"
          >
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-20 text-center tabular-nums">
            Página {pagina + 1} de {totalPaginas}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPaginaChange(pagina + 1)}
            disabled={pagina >= totalPaginas - 1}
            aria-label="Página siguiente"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </div>
  );
}

interface EmptySearchRowProps {
  colSpan: number;
  busqueda: string;
  onLimpiar: () => void;
}

export function EmptySearchRow({ colSpan, busqueda, onLimpiar }: EmptySearchRowProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-10 text-center whitespace-normal">
        <p className="text-sm text-muted-foreground">
          No hay coincidencias para <span className="font-medium text-foreground">“{busqueda}”</span>.
        </p>
        <Button variant="link" size="sm" onClick={onLimpiar}>
          Limpiar búsqueda
        </Button>
      </TableCell>
    </TableRow>
  );
}

/** Props para que una fila de tabla se comporte como enlace accesible por teclado. */
export function filaInteractiva(onActivar: () => void) {
  return {
    tabIndex: 0,
    onClick: onActivar,
    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivar();
      }
    },
    className:
      "cursor-pointer outline-none focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
  };
}
