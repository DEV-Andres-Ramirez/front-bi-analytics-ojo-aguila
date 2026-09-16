"use client";

import { ArrowRightIcon, CircleAlertIcon, EyeIcon, EyeOffIcon, KeyRoundIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { login, type LoginState } from "@/server/auth/actions";
import { PARAM_DESTINO } from "@/lib/destino";

const ESTADO_INICIAL: LoginState = {};
const ID_TOKEN = "token";
const ID_AYUDA = "token-ayuda";
const ID_ERROR = "token-error";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, ESTADO_INICIAL);
  const [tokenVisible, setTokenVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { error, intento } = state;

  useEffect(() => {
    if (!error) return;
    toast.error(error, { id: "login-error" });
    inputRef.current?.focus();
  }, [error, intento]);

  return (
    <form action={formAction} noValidate aria-busy={pending} className="grid gap-5">
      <Suspense fallback={null}>
        <CampoDestino />
      </Suspense>

      <div className="grid gap-2">
        <Label htmlFor={ID_TOKEN}>Token de acceso</Label>
        <InputGroup className="h-11">
          <InputGroupAddon>
            <KeyRoundIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            id={ID_TOKEN}
            name="token"
            type={tokenVisible ? "text" : "password"}
            required
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Ingresa tu token"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${ID_ERROR} ${ID_AYUDA}` : ID_AYUDA}
            className="font-mono tracking-[0.2em] placeholder:font-sans placeholder:tracking-normal"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-sm"
              aria-label={tokenVisible ? "Ocultar token" : "Mostrar token"}
              aria-controls={ID_TOKEN}
              onClick={() => setTokenVisible((visible) => !visible)}
            >
              {tokenVisible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p id={ID_AYUDA} className="text-xs text-muted-foreground">
          Solicítalo al administrador de la plataforma.
        </p>
      </div>

      {error && (
        <p
          key={intento}
          id={ID_ERROR}
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive animate-shake"
        >
          <CircleAlertIcon aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="h-11 w-full text-base font-semibold">
        {pending ? (
          <>
            <Spinner aria-hidden="true" />
            Verificando…
          </>
        ) : (
          <>
            Ingresar
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </>
        )}
      </Button>
      <span aria-live="polite" className="sr-only">
        {pending ? "Verificando el token de acceso…" : ""}
      </span>
    </form>
  );
}

/** Conserva la ruta solicitada antes del login; la acción la valida antes de redirigir. */
function CampoDestino() {
  const destino = useSearchParams().get(PARAM_DESTINO);
  return destino ? <input type="hidden" name={PARAM_DESTINO} value={destino} /> : null;
}
