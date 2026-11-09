/* Offline cache. Bump VERSION when files change so phones pick up the update. */
const VERSION='andre-health-v1';
const FILES=['./','index.html','styles.css','app.js','exercises.js','manifest.webmanifest',
  'icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  // network first (so updates arrive), fall back to cache when offline
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(VERSION).then(ca=>ca.put(e.request,c));return r;})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))));
});
