import { BottomNav } from "@/components/navigation/BottomNav";
import { GeneradorAlertas } from "@/features/alertas/components/GeneradorAlertas";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col bg-white shadow-sm">
      <GeneradorAlertas />
      <main className="flex-1 pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
