import { LockKeyholeIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand/logo";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { getEnv } from "@/server/env";
import { AvisoSesionExpirada } from "./aviso-sesion-expirada";
import { BrandPanel } from "./brand-panel";
import { CintaTricolor } from "./cinta-tricolor";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default async function LoginPage() {
  // La duración de la sesión viene del entorno: se lee por solicitud y no durante el build.
  await connection();
  const horasSesion = getEnv().SESSION_TTL_HOURS;

  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <main className="relative isolate flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden px-4 py-12 sm:px-8">
        <FondoFormulario />
        <CintaTricolor className="absolute inset-x-0 top-0 h-1 lg:hidden" />
        <BrandLogo size={44} showTagline className="lg:hidden" />

        <Card className="relative w-full max-w-md shadow-xl shadow-black/5 [--card-spacing:--spacing(6)] animate-in duration-500 fill-mode-both fade-in slide-in-from-bottom-4 sm:[--card-spacing:--spacing(8)] dark:shadow-black/40">
          <div
            aria-hidden="true"
            className="absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-gold to-transparent"
          />
          <CardHeader className="gap-2">
            <span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-gold/15 text-gold-foreground ring-1 ring-gold/30 dark:text-gold">
              <ShieldCheckIcon aria-hidden="true" className="size-5" />
            </span>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Acceso seguro</h1>
            <CardDescription>Ingresa tu token de acceso para consultar los resultados electorales.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <Suspense fallback={null}>
              <AvisoSesionExpirada />
            </Suspense>
            <LoginForm />
          </CardContent>
          <CardFooter className="justify-center gap-2 text-xs text-muted-foreground">
            <LockKeyholeIcon aria-hidden="true" className="size-3.5" />
            Conexión cifrada · Sesión de {horasSesion} {horasSesion === 1 ? "hora" : "horas"}
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground lg:hidden">
          Fuente: Registraduría Nacional del Estado Civil
        </p>
      </main>

      <BrandPanel />
    </div>
  );
}

function FondoFormulario() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-grid-pattern mask-radial-from-0% mask-radial-to-70%" />
      <div className="absolute top-1/2 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-3xl" />
    </div>
  );
}
