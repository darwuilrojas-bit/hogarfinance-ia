import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HogarFinance IA",
  description:
    "Sistema inteligente de gestión de finanzas y comprobantes del hogar",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HogarFinance IA",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1F6FEB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      {/* suppressHydrationWarning: extensiones como Grammarly inyectan
          atributos en <body> y generan falsas advertencias de hidratación */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
