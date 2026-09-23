/* Tartan push service worker */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data.json(); } catch (e) { data = { title: "Tartan", body: event.data && event.data.text() }; }
  const title = data.title || "Tartan";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      badge: "/favicon.ico",
      icon: "/favicon.ico",
      vibrate: [40, 30, 40],
      data: { url: data.url || "/" },
      tag: "tartan-activity",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
