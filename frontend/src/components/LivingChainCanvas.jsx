import React, { useEffect, useRef } from "react";

// Lightweight full-bleed generative "living chain" organism.
export const LivingChainCanvas = ({ burstKey = 0, className }) => {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const stateRef = useRef({ nodes: [], bursts: [], lowPerf: false });
  const rafRef = useRef(null);
  const burstRef = useRef(0);

  // spawn a burst when burstKey changes
  useEffect(() => {
    if (burstKey === burstRef.current) return;
    burstRef.current = burstKey;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const x = w * (0.2 + Math.random() * 0.6);
    const y = h * (0.2 + Math.random() * 0.6);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const sp = 1.5 + Math.random() * 2.5;
      stateRef.current.bursts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
    }
  }, [burstKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const isMobile = window.innerWidth < 640;
    let count = isMobile ? 28 : 68;

    const init = () => {
      const wrap = wrapRef.current;
      const w = wrap.clientWidth, h = wrap.clientHeight;
      stateRef.current.nodes = Array.from({ length: count }).map(() => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 1 + Math.random() * 2,
        hue: Math.random() > 0.5 ? "0,240,255" : "0,255,102",
        phase: Math.random() * Math.PI * 2,
      }));
    };
    init();

    let frames = 0, slowFrames = 0, last = performance.now();
    const maxDist = isMobile ? 120 : 150;

    const draw = (now) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // perf watch
      const dt = now - last;
      last = now;
      frames++;
      if (dt > 40) slowFrames++;
      if (frames === 60) {
        if (slowFrames > 18 && !stateRef.current.lowPerf) {
          stateRef.current.lowPerf = true;
          stateRef.current.nodes = stateRef.current.nodes.slice(0, Math.floor(count / 2));
        }
        frames = 0; slowFrames = 0;
      }
      const low = stateRef.current.lowPerf;
      const nodes = stateRef.current.nodes;
      const t = now / 1000;

      // update + connections
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx + Math.sin(t * 0.4 + n.phase) * 0.12;
        n.y += n.vy + Math.cos(t * 0.35 + n.phase) * 0.12;
        if (n.x < 0) n.x = w; if (n.x > w) n.x = 0;
        if (n.y < 0) n.y = h; if (n.y > h) n.y = 0;
      }

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < maxDist) {
            const op = (1 - d / maxDist) * 0.5;
            if (low) {
              ctx.strokeStyle = `rgba(0,240,255,${op * 0.6})`;
              ctx.lineWidth = 0.6;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            } else {
              const mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.12;
              const my = (a.y + b.y) / 2 + (b.x - a.x) * 0.12;
              const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
              g.addColorStop(0, `rgba(${a.hue},${op})`);
              g.addColorStop(1, `rgba(${b.hue},${op})`);
              ctx.strokeStyle = g;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.quadraticCurveTo(mx, my, b.x, b.y);
              ctx.stroke();

              // traveling pulse on some connections
              if ((i + j) % 7 === 0) {
                const tt = (t * 0.5 + (i + j) * 0.13) % 1;
                const bx = (1 - tt) * (1 - tt) * a.x + 2 * (1 - tt) * tt * mx + tt * tt * b.x;
                const by = (1 - tt) * (1 - tt) * a.y + 2 * (1 - tt) * tt * my + tt * tt * b.y;
                ctx.fillStyle = "rgba(0,240,255,0.9)";
                ctx.beginPath();
                ctx.arc(bx, by, 1.4, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
      }

      // node glow
      for (const n of nodes) {
        const pr = n.r * (1 + Math.sin(t * 1.5 + n.phase) * 0.2);
        if (!low) {
          const gg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, pr * 5);
          gg.addColorStop(0, `rgba(${n.hue},0.5)`);
          gg.addColorStop(1, `rgba(${n.hue},0)`);
          ctx.fillStyle = gg;
          ctx.beginPath();
          ctx.arc(n.x, n.y, pr * 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(${n.hue},0.95)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, pr, 0, Math.PI * 2);
        ctx.fill();
      }

      // bursts
      const bursts = stateRef.current.bursts;
      for (let i = bursts.length - 1; i >= 0; i--) {
        const p = bursts[i];
        p.x += p.vx; p.y += p.vy; p.vx *= 0.97; p.vy *= 0.97; p.life -= 0.02;
        if (p.life <= 0) { bursts.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(0,255,102,${p.life})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2 * p.life + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    const onResize = () => init();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div ref={wrapRef} className={`absolute inset-0 overflow-hidden ${className || ""}`} aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
