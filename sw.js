// Lets the site be installed as an app. It deliberately caches nothing,
// so a new version you upload to GitHub shows up right away.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
