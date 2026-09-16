import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CardTitle } from "@/components/ui/card";

interface CardHeadingProps {
  id: string;
  icono: LucideIcon;
  children: ReactNode;
}

/** Título de tarjeta con ícono; `id` permite etiquetar la región con `aria-labelledby`. */
export function CardHeading({ id, icono: Icono, children }: CardHeadingProps) {
  return (
    <CardTitle className="flex min-w-0 items-center gap-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icono aria-hidden className="size-3.5" />
      </span>
      <h2 id={id} className="min-w-0 text-balance">
        {children}
      </h2>
    </CardTitle>
  );
}
