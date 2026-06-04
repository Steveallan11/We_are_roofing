const CACHE_NAME = 'we-are-roofing-offline-v1';
const UPLOAD_QUEUE = 'upload-queue';

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Installation complete');
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - intercept requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Handle API requests with offline queue
  if (url.pathname.startsWith('/api/')) {
    if (request.method === 'POST' || request.method === 'PUT') {
      event.respondWith(handleQueueableRequest(request));
    } else {
      event.respondWith(handleNetworkFirst(request));
    }
    return;
  }

  // Default: network first, fallback to cache
  event.respondWith(handleNetworkFirst(request));
});

async function handleNetworkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    return cached || new Response('Offline - resource not available', { status: 503 });
  }
}

async function handleQueueableRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Clear this request from queue if it was queued
      await clearFromQueue(request.url);
      // Notify clients that upload succeeded
      notifyClients({ type: 'UPLOAD_SUCCESS', url: request.url });
    }
    return response;
  } catch (error) {
    // Queue for later retry
    await queueRequest(request);
    notifyClients({ type: 'OFFLINE_QUEUED', url: request.url });
    return new Response(JSON.stringify({ queued: true, message: 'Request queued for offline - will sync when online' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function queueRequest(request) {
  try {
    const db = await openDatabase();
    const clonedRequest = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.clone().text(),
      timestamp: Date.now()
    };

    db.add(UPLOAD_QUEUE, clonedRequest);
  } catch (error) {
    console.error('[ServiceWorker] Error queuing request:', error);
  }
}

async function clearFromQueue(url) {
  try {
    const db = await openDatabase();
    const allRequests = await db.getAll(UPLOAD_QUEUE);
    const toDelete = allRequests.filter((req) => req.url === url);
    toDelete.forEach((req) => db.delete(UPLOAD_QUEUE, req.timestamp));
  } catch (error) {
    console.error('[ServiceWorker] Error clearing from queue:', error);
  }
}

async function retrySyncQueue() {
  try {
    const db = await openDatabase();
    const queuedRequests = await db.getAll(UPLOAD_QUEUE);

    for (const queuedReq of queuedRequests) {
      try {
        const response = await fetch(queuedReq.url, {
          method: queuedReq.method,
          headers: queuedReq.headers,
          body: queuedReq.body
        });

        if (response.ok) {
          db.delete(UPLOAD_QUEUE, queuedReq.timestamp);
          notifyClients({ type: 'QUEUED_UPLOAD_SYNCED', url: queuedReq.url });
        }
      } catch (error) {
        console.error('[ServiceWorker] Error retrying queued request:', error);
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Error retrying queue:', error);
  }
}

// Listen for online/offline events
self.addEventListener('online', () => {
  notifyClients({ type: 'ONLINE' });
  retrySyncQueue();
});

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WeAreRoofing', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      resolve({
        get: (store, key) =>
          new Promise((res, rej) => {
            const req = db.transaction(store).objectStore(store).get(key);
            req.onerror = () => rej(req.error);
            req.onsuccess = () => res(req.result);
          }),
        getAll: (store) =>
          new Promise((res, rej) => {
            const req = db.transaction(store).objectStore(store).getAll();
            req.onerror = () => rej(req.error);
            req.onsuccess = () => res(req.result);
          }),
        add: (store, value) =>
          new Promise((res, rej) => {
            const req = db.transaction(store, 'readwrite').objectStore(store).add(value);
            req.onerror = () => rej(req.error);
            req.onsuccess = () => res(req.result);
          }),
        delete: (store, key) =>
          new Promise((res, rej) => {
            const req = db.transaction(store, 'readwrite').objectStore(store).delete(key);
            req.onerror = () => rej(req.error);
            req.onsuccess = () => res(req.result);
          })
      });
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(UPLOAD_QUEUE)) {
        db.createObjectStore(UPLOAD_QUEUE, { keyPath: 'timestamp' });
      }
    };
  });
}

function notifyClients(message) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage(message);
    });
  });
}
