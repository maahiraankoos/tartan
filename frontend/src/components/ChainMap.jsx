import React, { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";

export const ChainMap = ({ token }) => {
  const { t } = useApp();
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const dataRef = useRef({ nodes: [], hub: "Garowe" });
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const rafRef = useRef(null);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data } = await api.get(`/tartans/${token}/map`);
        if (alive) dataRef.current = data;
      } catch (e) {}
    };
    load();
    const iv = setInterval(load, 6000);
    return () => { alive = false; clearInterval(iv); };
  }, [token]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let t0 = performance.now();

    const draw = (now) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const time = (now - t0) / 1000;
      const z = zoomRef.current;
      const { nodes, hub } = dataRef.current;
      const cx = w / 2;
      const cy = h / 2;

      const pos = (n) => ({
        x: cx + (n.x - 0.5) * w * 0.86 * z,
        y: cy + (n.y - 0.5) * h * 0.86 * z,
      });

      const hubNode = nodes.find((n) => n.city === hub) || nodes[0];
      const maxCount = Math.max(1, ...nodes.map((n) => n.count));

      // arcs from hub to each node
      if (hubNode) {
        const hp = pos(hubNode);
        nodes.forEach((n) => {
          if (n === hubNode) return;
          const p = pos(n);
          const mx = (hp.x + p.x) / 2;
          const my = (hp.y + p.y) / 2 - Math.hypot(p.x - hp.x, p.y - hp.y) * 0.22;
          const grad = ctx.createLinearGradient(hp.x, hp.y, p.x, p.y);
          grad.addColorStop(0, "rgba(0,240,255,0.55)");
          grad.addColorStop(1, "rgba(0,255,102,0.15)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(hp.x, hp.y);
          ctx.quadraticCurveTo(mx, my, p.x, p.y);
          ctx.stroke();

          // moving pulse along arc
          const tt = (time * 0.35 + (n.x + n.y)) % 1;
          const bx = (1 - tt) * (1 - tt) * hp.x + 2 * (1 - tt) * tt * mx + tt * tt * p.x;
          const by = (1 - tt) * (1 - tt) * hp.y + 2 * (1 - tt) * tt * my + tt * tt * p.y;
          ctx.fillStyle = "rgba(0,240,255,0.9)";
          ctx.beginPath();
          ctx.arc(bx, by, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // nodes
      nodes.forEach((n) => {
        const p = pos(n);
        const r = 4 + (n.count / maxCount) * 14 * Math.min(1.4, z);
        const pulse = 1 + Math.sin(time * 2 + n.x * 6) * 0.12;
        const isHub = n === hubNode;
        const color = isHub ? "0,240,255" : "0,255,102";

        // glow
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
        g.addColorStop(0, `rgba(${color},0.5)`);
        g.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3 * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgb(${color})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(240,246,255,0.92)";
        ctx.font = `${isHub ? 700 : 500} 11px 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.fillText(`${n.city} · ${n.count}`, p.x, p.y - r - 6);
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative h-[340px] sm:h-[440px] rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#050810]"
      data-testid="chain-map"
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute top-3 left-3 text-[10px] uppercase tracking-widest text-cyan-400/80 bg-black/40 px-2 py-1 rounded-md backdrop-blur">
        {t("the_map")}
      </div>
      <div className="absolute bottom-3 right-3 flex flex-col gap-2">
        <button
          data-testid="map-zoom-in-button"
          onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)))}
          className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-900/80 border border-slate-700 text-cyan-300 hover:border-cyan-400 backdrop-blur"
        >
          <ZoomIn size={16} />
        </button>
        <button
          data-testid="map-zoom-out-button"
          onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
          className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-900/80 border border-slate-700 text-cyan-300 hover:border-cyan-400 backdrop-blur"
        >
          <ZoomOut size={16} />
        </button>
        <button
          data-testid="map-zoom-reset-button"
          onClick={() => setZoom(1)}
          className="h-9 w-9 flex items-center justify-center rounded-lg bg-slate-900/80 border border-slate-700 text-cyan-300 hover:border-cyan-400 backdrop-blur"
        >
          <Maximize2 size={15} />
        </button>
      </div>
    </div>
  );
};
