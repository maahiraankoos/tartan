import React, { useEffect, useRef, useState } from "react";
import { fmtNum } from "@/lib/helpers";

export const AnimatedNumber = ({ value, className, format = true }) => {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  const raf = useRef(null);

  useEffect(() => {
    const from = prev.current;
    const to = value || 0;
    const start = performance.now();
    const dur = 700;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  return <span className={className}>{format ? fmtNum(display) : display}</span>;
};
