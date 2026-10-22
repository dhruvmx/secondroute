const CACHE = "secondroute-shell-v3";
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const shell = await fetch("/");
      if (!shell.ok) throw Error("Application shell unavailable");
      const html = await shell.clone().text();
      await cache.put("/", shell);
      const assets = [
        ...new Set(
          [...html.matchAll(/(?:src|href)="([^\"]+)"/g)]
            .map((match) => match[1].replaceAll("&amp;", "&"))
            .filter((url) => url.startsWith("/_next/static/")),
        ),
      ];
      await cache.addAll(assets);
    })(),
  );
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      for (const key of await caches.keys()) {
        if (key.startsWith("secondroute-shell-") && key !== CACHE)
          await caches.delete(key);
      }
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== location.origin ||
    (url.pathname !== "/" && !url.pathname.startsWith("/_next/static/")) ||
    url.search.length > 0
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then(
            (cached) =>
              cached ||
              (event.request.mode === "navigate"
                ? caches.match("/")
                : Response.error()),
          ),
      ),
  );
});
