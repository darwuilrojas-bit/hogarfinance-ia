import type { Categoria } from "@/lib/supabase/types";

const PATHS: Record<Categoria, string> = {
  // Rayo (electricidad)
  electricidad: "m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z",
  // Gota (agua)
  agua: "M12 21a7.5 7.5 0 0 0 7.5-7.5c0-1.93-.855-3.98-2.02-5.91-1.16-1.92-2.58-3.64-3.72-4.9a2.38 2.38 0 0 0-3.52 0c-1.14 1.26-2.56 2.98-3.72 4.9C5.355 9.52 4.5 11.57 4.5 13.5A7.5 7.5 0 0 0 12 21Z",
  // Llama (gas)
  gas: "M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z",
  // Wifi (internet)
  internet:
    "M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z",
  // Casa (alquiler)
  alquiler:
    "M2.25 12 11.2 3.05a1.125 1.125 0 0 1 1.59 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75",
  // Edificio (expensas)
  expensas:
    "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
  // Etiqueta (otro)
  otro: "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z M6 6h.008v.008H6V6Z",
};

type CategoriaIconProps = {
  categoria: Categoria;
  className?: string;
};

/** Ícono de línea para cada categoría de servicio del hogar. */
export function CategoriaIcon({
  categoria,
  className = "h-5 w-5",
}: CategoriaIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={PATHS[categoria]} />
    </svg>
  );
}
