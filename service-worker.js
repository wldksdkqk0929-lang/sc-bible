/* service-worker.js
 * 목적:
 * - index.html / manifest.json 은 절대 Cache-First 금지 (항상 네트워크 우선)
 * - 나머지 정적 리소스는 캐시로 가속
 * - 구버전 캐시 싹 정리 + 즉시 제어권 확보
 */

const SW_VERSION = 'v24.7.0';          // 원하는 버전 문자열로만 관리
const CACHE_STATIC = `amgi-static-${SW_VERSION}`;

// 캐시해도 되는 "정적"만 넣으세요 (manifest/index 제외)
const PRECACHE_URLS = [
  './',
  // index.html?v=24는 아래 fetch 전략에서 처리하므로 프리캐시에서는 굳이 넣지 않아도 되지만,
  // 오프라인 fallback을 위해 기본 경로 정도는 둡니다.
  'https://cdn-icons-png.flaticon.com/512/3209/3209265.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 기존 캐시 전부 정리(버전 바뀔 때마다 강제 청소)
    const keys = await caches.keys();
    await Promise.all(
      keys.map((key) => {
        if (key !== CACHE_STATIC) return caches.delete(key);
      })
    );

    // 즉시 모든 탭 제어
    await self.clients.claim();

    // 열린 탭들에게 "업데이트 완료" 신호
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION }));
  })());
});

/** 핵심 정책:
 * 1) manifest.json / index.html(네비게이션)은 Network-First (캐시 고착 방지)
 * 2) 나머지는 Stale-While-Revalidate(캐시 즉시 + 뒤에서 갱신)
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // GET만 처리
  if (req.method !== 'GET') return;

  // 1) manifest.json 은 무조건 네트워크(캐시 개입 최소화)
  if (url.pathname.endsWith('manifest.json')) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // 2) index.html 네비게이션도 Network-First (PWA UI/이름/아이콘 갱신 안정화)
  // navigation 요청(주소창 이동/새로고침 등)
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }

  // 3) 그 외 정적 리소스는 Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    const cache = await caches.open(CACHE_STATIC);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // 최후: 프리캐시된 엔트리라도 반환
    const fallback = await caches.match('./');
    return fallback || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((fresh) => {
    cache.put(request, fresh.clone());
    return fresh;
  }).catch(() => null);

  return cached || (await fetchPromise) || Response.error();
}