import React, { useState } from "react";
import { avatarFor } from "@/lib/helpers";
import { cn } from "@/lib/utils";

export const Avatar = ({ name, src, size = 40, className, ring = false, testid }) => {
  const { grad, initials } = avatarFor(name);
  const [err, setErr] = useState(false);

  if (src && !err) {
    return (
      <img
        data-testid={testid}
        src={src}
        alt={name}
        onError={() => setErr(true)}
        className={cn(
          "rounded-full object-cover shrink-0 bg-slate-800",
          ring && "ring-2 ring-cyan-400/70",
          className
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      data-testid={testid}
      className={cn(
        "flex items-center justify-center rounded-full font-display font-bold text-slate-950 select-none shrink-0",
        ring && "ring-2 ring-cyan-400/70",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})`,
      }}
      title={name}
    >
      {initials}
    </div>
  );
};
