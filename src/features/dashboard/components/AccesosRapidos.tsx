import Link from "next/link";

const ACCESOS = [
  {
    href: "/facturas/nueva",
    titulo: "Agregar factura",
    color: "bg-primary-light text-primary",
    icono: "M12 4.5v15m7.5-7.5h-15",
  },
  {
    href: "/comprobantes",
    titulo: "Buscar comprobantes",
    color: "bg-secondary-light text-secondary",
    icono: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z",
  },
  {
    href: "/reportes",
    titulo: "Reportes",
    color: "bg-primary-light text-primary",
    icono: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
  },
  {
    href: "/perfil",
    titulo: "Presupuesto",
    color: "bg-secondary-light text-secondary",
    icono: "M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3",
  },
] as const;

/** Los 4 accesos rápidos del dashboard, en grilla de 2 × 2. */
export function AccesosRapidos() {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">
        Accesos rápidos
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {ACCESOS.map((a) => (
          <Link
            key={a.href + a.titulo}
            href={a.href}
            className={`flex h-20 flex-col justify-between rounded-2xl p-3.5 transition-transform active:scale-95 ${a.color}`}
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={a.icono} />
            </svg>
            <span className="text-sm font-semibold leading-tight">
              {a.titulo}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
