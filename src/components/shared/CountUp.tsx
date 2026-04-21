"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  value: number;
  durationMs?: number;
  formatter?: (v: number) => string;
};

export function CountUp({ value, durationMs = 650, formatter }: Props) {
  const fmt = useMemo(() => formatter ?? ((v: number) => v.toLocaleString("pt-BR")), [formatter]);
  const [n, setN] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = n;
    const to = value;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{fmt(Math.round(n))}</>;
}

