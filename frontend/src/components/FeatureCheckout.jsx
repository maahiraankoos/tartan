import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Star, Check, Sparkles } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

export const FeatureCheckout = ({ tartan, onDone, trigger }) => {
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState("30d");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      api.get("/feature-plans").then(({ data }) => setPlans(data)).catch(() => setPlans([]));
      setDone(false);
    }
  }, [open]);

  const submit = async () => {
    setLoading(true);
    try {
      await api.post(`/tartans/${tartan.token}/feature-order`, { plan: selected });
      setDone(true);
      if (onDone) onDone();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button data-testid={`feature-checkout-open-${tartan.token}`} className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-amber-200">
            <Star size={12} /> Get featured
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="glass border-amber-500/30 sm:max-w-md" data-testid="feature-checkout-modal">
        <DialogHeader>
          <DialogTitle className="font-unbounded text-2xl text-white flex items-center gap-2">
            <Star size={20} className="text-amber-400" /> Feature this chain
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center" data-testid="feature-checkout-success">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-4">
              <Check size={26} className="text-emerald-400" />
            </div>
            <h3 className="font-unbounded font-bold text-white text-lg">Request received</h3>
            <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
              We'll arrange payment offline and activate your featured placement. You'll see it go live on <span className="text-white font-semibold">{tartan.title}</span> once confirmed.
            </p>
            <button data-testid="feature-checkout-close" onClick={() => setOpen(false)} className="mt-5 h-11 px-6 rounded-full font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 active:scale-95 transition-transform">
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-400 -mt-1">Put <span className="text-white font-semibold">{tartan.title}</span> on the home page and top of its category. Pick a duration:</p>

            <div className="space-y-2.5 pt-1">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`feature-plan-${p.id}`}
                  onClick={() => setSelected(p.id)}
                  className={`w-full flex items-center justify-between rounded-2xl border p-4 text-left transition-all ${selected === p.id ? "border-amber-400 bg-amber-500/10" : "border-slate-700 bg-slate-900/40 hover:border-slate-600"}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-unbounded font-bold text-white">{p.label}</span>
                      {p.best_value && <span className="text-[10px] uppercase tracking-widest text-emerald-300 border border-emerald-500/40 rounded-full px-1.5">Best value</span>}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{p.blurb}</div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="font-mono text-xl font-extrabold text-amber-300">${p.price}</div>
                    <div className="text-[10px] text-slate-500">{p.currency}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 mt-1 flex items-start gap-2">
              <Sparkles size={14} className="text-cyan-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400">Payment is arranged offline for now. Submit your request and our team activates the placement once payment is confirmed. It auto-expires when the period ends.</p>
            </div>

            <button
              data-testid="feature-checkout-submit"
              onClick={submit}
              disabled={loading || !selected}
              className="w-full h-12 rounded-full font-unbounded font-bold text-slate-950 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-orange-400 active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Star size={18} />}
              {loading ? "Submitting…" : `Request featuring · $${PLAN_PRICE(plans, selected)}`}
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

function PLAN_PRICE(plans, id) {
  const p = plans.find((x) => x.id === id);
  return p ? p.price : "";
}
