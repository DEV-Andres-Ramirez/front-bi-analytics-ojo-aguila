"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ThemeMode } from "@/lib/palette";
import { THEME_STORAGE_KEY, type ThemePreference } from "./theme-constants";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function resolve(preference: ThemePreference): ThemeMode {
  if (preference !== "system") return preference;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function applyToDocument(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const media = window.matchMedia(DARK_QUERY);
  const handleSystemChange = () => {
    if (readPreference() === "system") applyToDocument(resolve("system"));
    onChange();
  };
  // Otra pestaña cambió el tema: además de la preferencia, hay que aplicarlo a este documento.
  const handleStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) applyToDocument(resolve(readPreference()));
    onChange();
  };
  media.addEventListener("change", handleSystemChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", handleSystemChange);
    window.removeEventListener("storage", handleStorage);
  };
}

/** Tema claro/oscuro con preferencia persistida en localStorage (sin next-themes). */
export function useTheme() {
  const preference = useSyncExternalStore<ThemePreference>(subscribe, readPreference, () => "system");
  const resolvedTheme = useSyncExternalStore<ThemeMode>(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light",
  );

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage no disponible: se aplica solo para la sesión actual.
    }
    applyToDocument(resolve(next));
    listeners.forEach((listener) => listener());
  }, []);

  return { theme: preference, resolvedTheme, setTheme };
}
