"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo, LogoMark } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import type { Catalogo } from "@/domain/types";
import { CommandSearch } from "./command-search";
import { FiltrosEleccion, FiltrosEleccionSkeleton } from "./filtros-eleccion";
import { FiltrosSheet } from "./filtros-sheet";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * Header del dashboard. Usa `useSearchParams` (vía `useFiltrosUrl`): debe ir dentro de
 * un <Suspense> con `AppHeaderFallback` como fallback.
 */
export function AppHeader({ catalogo }: { catalogo: Catalogo }) {
  return (
    <HeaderShell>
      <Marca />
      <div className="hidden min-w-0 flex-1 justify-center lg:flex">
        <FiltrosEleccion catalogo={catalogo} orientation="horizontal" />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
        <FiltrosSheet catalogo={catalogo} className="mr-0.5 lg:hidden" />
        <CommandSearch />
        <ThemeToggle />
        <UserMenu />
      </div>
    </HeaderShell>
  );
}

/** Esqueleto con la misma altura y distribución del header (sin hooks de URL). */
export function AppHeaderFallback() {
  return (
    <HeaderShell>
      <Marca />
      <div className="hidden min-w-0 flex-1 justify-center lg:flex">
        <FiltrosEleccionSkeleton />
      </div>
      <div aria-hidden className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
        <Skeleton className="mr-0.5 h-8 w-28 lg:hidden" />
        <Skeleton className="h-8 w-8 md:w-44 lg:w-21 xl:w-48" />
        <Skeleton className="size-8" />
        <Skeleton className="size-8 rounded-full" />
      </div>
    </HeaderShell>
  );
}

function HeaderShell({ children }: { children: ReactNode }) {
  return (
    <header className="glass sticky top-0 z-40 w-full border-b">
      <div aria-hidden className="h-[3px] bg-tricolor" />
      <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </header>
  );
}

function Marca() {
  return (
    <Link
      href="/"
      aria-label="Ojo de Águila, ir al inicio"
      className="flex shrink-0 items-center rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <LogoMark size={32} className="sm:hidden" />
      <BrandLogo showTagline taglineClassName="hidden xl:block" className="hidden sm:flex" />
    </Link>
  );
}
