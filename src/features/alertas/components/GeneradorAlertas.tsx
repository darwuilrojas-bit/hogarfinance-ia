"use client";

import { useEffect } from "react";
import { generarAlertas } from "../lib/generarAlertas";

/**
 * Componente invisible montado en el layout privado: ejecuta el motor
 * de alertas una vez por sesión de navegación y avisa al resto de la
 * app (p. ej. la campana del dashboard) para que refresque su badge.
 */
export function GeneradorAlertas() {
  useEffect(() => {
    if (sessionStorage.getItem("alertas-revisadas")) return;
    sessionStorage.setItem("alertas-revisadas", "1");
    generarAlertas()
      .then(() => {
        window.dispatchEvent(new Event("alertas-actualizadas"));
      })
      .catch(() => {
        // Si falla (p. ej. sin conexión), se reintenta en la próxima sesión
        sessionStorage.removeItem("alertas-revisadas");
      });
  }, []);

  return null;
}
