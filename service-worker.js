// [중요] 버전을 v1 -> v2로 변경하여 강제 갱신 유도
const CACHE_NAME = 'amgi-pakpak-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn-icons-png.flaticon.com/512/3209/3209265.png'
];

self.addEventListener('install', event => {
  // 새 서비스 워커가 설치될 때 즉시 대기 상태를 건너뜀
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  // 활성화될 때 옛날 캐시(v1)를 삭제함
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // 모든 탭에서 즉시 제어권을 가짐
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 캐시에 있으면 그거 주고, 없으면 네트워크로 감
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});