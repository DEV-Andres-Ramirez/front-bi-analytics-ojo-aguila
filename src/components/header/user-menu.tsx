"use client";

import { LogOutIcon, ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import { useRef, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { logout } from "@/server/auth/actions";

/**
 * El contenido del menú vive en un portal (fuera del <form> en el DOM), así que el ítem
 * envía el formulario con `requestSubmit` en lugar de ser un botón `submit`.
 */
export function UserMenu() {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={logout}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <BotonUsuario />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2.5 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-foreground dark:text-gold">
              <ShieldCheckIcon aria-hidden className="size-4" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">Sesión activa</span>
              <span className="text-xs font-normal">Acceso con token</span>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => formRef.current?.requestSubmit()}>
            <LogOutIcon aria-hidden />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </form>
  );
}

function BotonUsuario({ className, ...props }: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();

  return (
    <Button
      {...props}
      type="button"
      variant="ghost"
      size="icon"
      aria-label={pending ? "Cerrando sesión" : "Menú de usuario"}
      aria-busy={pending}
      className={cn("rounded-full border-border bg-muted/50 hover:border-gold/50", className)}
    >
      {pending ? <Spinner aria-hidden /> : <UserRoundIcon aria-hidden />}
    </Button>
  );
}
