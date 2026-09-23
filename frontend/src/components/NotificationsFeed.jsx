import React, { useEffect, useState, useCallback } from "react";
import { Bell, Zap } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useApp } from "@/context/AppContext";
import { timeAgo } from "@/lib/helpers";
import api from "@/lib/api";

export const NotificationsFeed = ({ shareToken, refreshKey = 0 }) => {
  const { t } = useApp();
  const [data, setData] = useState({ notifications: [], unread: 0 });

  const load = useCallback(() => {
    api.get(`/members/${shareToken}/notifications`).then(({ data }) => setData(data)).catch(() => {});
  }, [shareToken]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const markRead = () => {
    if (!data.unread) return;
    api.post(`/members/${shareToken}/notifications/read`).then(() => setData((d) => ({ ...d, unread: 0 }))).catch(() => {});
  };

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-[#0E1526] p-5" data-testid="notifications-feed">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 font-unbounded font-bold text-white">
          <span className="relative">
            <Bell size={17} className="text-cyan-400" />
            {data.unread > 0 && (
              <span data-testid="notif-unread-dot" className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-500 border border-[#0E1526]" />
            )}
          </span>
          {t("activity")}
        </h3>
        {data.unread > 0 && (
          <button data-testid="notif-mark-read" onClick={markRead} className="text-[11px] text-cyan-300 hover:text-cyan-200">
            Mark read ({data.unread})
          </button>
        )}
      </div>

      {data.notifications.length === 0 ? (
        <p className="text-sm text-slate-500 py-2">{t("no_activity")}</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {data.notifications.map((n) => (
            <div key={n.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${n.read ? "" : "bg-cyan-500/5"}`}>
              <Avatar name={n.joiner_nickname} size={30} />
              <p className="text-sm text-slate-300 flex-1 min-w-0">
                <span className="font-semibold text-white">{n.joiner_nickname}</span>{" "}
                <span className="text-slate-400">{n.type === "direct" ? t("joined_through_you") : t("joined_your_branch")}</span>
                {n.joiner_city && <span className="text-slate-600"> · {n.joiner_city}</span>}
              </p>
              <span className="text-[10px] text-slate-500 shrink-0">{timeAgo(n.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
