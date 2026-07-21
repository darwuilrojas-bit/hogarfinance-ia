type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

/** Estado vacío para secciones cuya funcionalidad llegará próximamente. */
export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-primary">
        {icon}
      </div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="text-sm leading-relaxed text-gray-500">{description}</p>
      <span className="mt-1 rounded-full bg-secondary-light px-3 py-1 text-xs font-medium text-secondary">
        Próximamente
      </span>
    </div>
  );
}
