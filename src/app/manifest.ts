import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HogarFinance IA",
    short_name: "HogarFinance",
    description:
      "Sistema inteligente de gestión de finanzas y comprobantes del hogar",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1F6FEB",
    lang: "es",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}
