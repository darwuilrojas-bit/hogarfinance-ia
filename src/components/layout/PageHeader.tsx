type PageHeaderProps = {
  title: string;
  subtitle?: string;
};

/** Encabezado fijo de cada sección, estilo app móvil. */
export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 px-5 pb-3 pt-5 backdrop-blur">
      <h1 className="text-xl font-bold tracking-tight text-gray-900">
        {title}
      </h1>
      {subtitle ? <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p> : null}
    </header>
  );
}
