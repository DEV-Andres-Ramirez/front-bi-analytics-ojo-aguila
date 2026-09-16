import { THEME_STORAGE_KEY } from "./theme-constants";

/**
 * Aplica el tema guardado antes del primer pintado (evita el destello claro/oscuro).
 * Ver node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 */
export function ThemeScript() {
  const script = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
