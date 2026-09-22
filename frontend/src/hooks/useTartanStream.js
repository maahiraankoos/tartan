import { useEffect, useRef, useState } from "react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function useTartanStream(token, { onJoin } = {}) {
  const [stats, setStats] = useState(null);
  const onJoinRef = useRef(onJoin);
  useEffect(() => {
    onJoinRef.current = onJoin;
  });

  useEffect(() => {
    if (!token) return;
    let es;
    try {
      es = new EventSource(`${API}/tartans/${token}/stream`, { withCredentials: true });
    } catch (e) {
      return;
    }
    es.addEventListener("stats", (e) => {
      try {
        setStats(JSON.parse(e.data));
      } catch (err) {}
    });
    es.addEventListener("join", (e) => {
      try {
        const d = JSON.parse(e.data);
        if (onJoinRef.current) onJoinRef.current(d);
      } catch (err) {}
    });
    es.onerror = () => {};
    return () => es.close();
  }, [token]);

  return { stats };
}
