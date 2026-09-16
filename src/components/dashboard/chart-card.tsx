import type { LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CardHeading } from "./card-heading";

interface ChartCardProps {
  titulo: string;
  descripcion: string;
  icono: LucideIcon;
  /** Clase de altura del lienzo (las gráficas llenan su contenedor). */
  altoClassName?: string;
  className?: string;
  children: ReactNode;
}

export function ChartCard({
  titulo,
  descripcion,
  icono,
  altoClassName = "h-80",
  className,
  children,
}: ChartCardProps) {
  const tituloId = useId();

  return (
    <Card role="region" aria-labelledby={tituloId} className={cn("min-w-0", className)}>
      <CardHeader>
        <CardHeading id={tituloId} icono={icono}>
          {titulo}
        </CardHeading>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className={cn("relative w-full", altoClassName)}>{children}</div>
      </CardContent>
    </Card>
  );
}
