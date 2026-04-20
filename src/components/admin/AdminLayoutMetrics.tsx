"use client";

import { useEffect } from "react";

/**
 * Instrumentação de layout (debug): mede viewport vs largura útil do painel.
 */
export function AdminLayoutMetrics() {
  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(".orbit-main-inner");
      const r = el?.getBoundingClientRect();
      const cs = el ? getComputedStyle(el) : null;
      const dash = document.querySelector(".admin-dashboard-root");
      const dr = dash?.getBoundingClientRect();
      // #region agent log
      fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
        body: JSON.stringify({
          sessionId: "03dbee",
          location: "AdminLayoutMetrics.tsx:measure",
          message: "admin shell layout metrics",
          data: {
            hypothesisId: "H1-H2-widths",
            innerWidth: window.innerWidth,
            mainInnerWidth: r?.width ?? null,
            mainInnerMaxWidth: cs?.maxWidth ?? null,
            dashboardRootWidth: dr?.width ?? null,
            dashboardVsMain:
              r?.width != null && dr?.width != null ? Math.round(r.width - dr.width) : null,
            sidebarVar: cs?.getPropertyValue("--sidebar-w")?.trim() ?? null,
          },
          timestamp: Date.now(),
          hypothesisId: "H1-H2-widths",
        }),
      }).catch(() => {});
      // #endregion
    };
    measure();
    const t = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(t);
  }, []);

  return null;
}
