"use client";

import { MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ThemePreference } from "@/components/theme/theme-constants";
import { useTheme } from "@/components/theme/use-theme";

const OPCIONES: { valor: ThemePreference; etiqueta: string; Icono: LucideIcon }[] = [
  { valor: "light", etiqueta: "Claro", Icono: SunIcon },
  { valor: "dark", etiqueta: "Oscuro", Icono: MoonIcon },
  { valor: "system", etiqueta: "Sistema", Icono: MonitorIcon },
];

function esPreferencia(valor: string): valor is ThemePreference {
  return OPCIONES.some((opcion) => opcion.valor === valor);
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Cambiar tema" className="relative overflow-hidden">
          <SunIcon
            aria-hidden
            className="scale-100 rotate-0 transition-transform duration-500 ease-out dark:scale-0 dark:-rotate-90"
          />
          <MoonIcon
            aria-hidden
            className="absolute scale-0 rotate-90 transition-transform duration-500 ease-out dark:scale-100 dark:rotate-0"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(valor) => {
            if (esPreferencia(valor)) setTheme(valor);
          }}
        >
          {OPCIONES.map(({ valor, etiqueta, Icono }) => (
            <DropdownMenuRadioItem key={valor} value={valor}>
              <Icono aria-hidden />
              {etiqueta}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
