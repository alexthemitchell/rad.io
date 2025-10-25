# Offline-First Architecture with Progressive Web App Capabilities

## Context and Problem Statement

WebSDR Pro must function as professional RF instrumentation regardless of network connectivity. Field operations (emergency communications monitoring, remote installations, spectrum surveys) demand reliable operation without internet access. Additionally, privacy-conscious users require local-only operation without cloud dependencies. How do we architect the application to work completely offline after initial load while providing installable, app-like experience?

The PRD emphasizes "precision, power, and professionalism"—characteristics that require deterministic behavior unaffected by network conditions. Cloud dependencies would undermine reliability and user trust in the application as laboratory-grade instrumentation.

## Decision Drivers

- Field operations require offline capability (emergency comms, remote sites)
- Privacy and security: no data should leave the user's device
- Reliability: network issues must not impact signal analysis
- Performance: local processing eliminates latency from cloud round-trips
- PRD requirement: Complex Application must work without network dependency
- Professional instrumentation cannot rely on external services
- Zero server costs aligns with client-side architecture philosophy

## Considered Options

- **Option 1**: Full offline-first with Service Worker and PWA manifest
- **Option 2**: Online-only with cloud processing APIs
- **Option 3**: Hybrid approach (optional cloud sync)
- **Option 4**: No offline considerations (basic web app)

## Decision Outcome

Chosen option: **"Option 1: Full offline-first with Service Worker and PWA manifest"** because it aligns with professional instrumentation requirements, ensures privacy, enables field deployment, and provides app-like experience through PWA capabilities. All DSP, storage, and visualization are client-side, making network connectivity optional after initial load.

### Consequences

- Good, because application works reliably in field environments without connectivity
- Good, because user data never leaves device (privacy and security)
- Good, because zero server costs (no backend infrastructure needed)
- Good, because PWA enables installable app experience on mobile/desktop
- Good, because deterministic performance unaffected by network latency
- Good, because aligns with PRD's "offline-first" requirement (ADR-0005 storage strategy)
- Bad, because Service Worker adds complexity to development and debugging
- Bad, because cache invalidation requires versioning strategy
- Bad, because cannot leverage cloud-based signal databases (could be added as optional enhancement)
- Bad, because updates require cache busting and new Service Worker versions

### Confirmation

Success measured by: (1) Application loads and functions with network disabled, (2) PWA installability on Chrome/Edge/Safari, (3) All DSP operations complete offline, (4) Storage quota sufficient for multi-hour recordings, (5) Update mechanism works reliably.

## Pros and Cons of the Options

### Option 1: Full Offline-First (Chosen)

- Good, because enables field operations without connectivity
- Good, because user data stays local (privacy)
- Good, because zero server infrastructure costs
- Good, because predictable performance
- Good, because PWA provides native-app experience
- Neutral, because requires robust client-side architecture
- Bad, because more complex than online-only approach
- Bad, because debugging Service Workers challenging

### Option 2: Online-Only with Cloud APIs

- Good, because simpler architecture (no caching)
- Good, because could leverage cloud compute for heavy processing
- Good, because easier updates (no cache invalidation)
- Bad, because network dependency unacceptable for professional instrumentation
- Bad, because privacy concerns (data leaves device)
- Bad, because ongoing server costs
- Bad, because latency impacts real-time visualization
- Bad, because contradicts PRD offline-first requirement

### Option 3: Hybrid Approach

- Good, because flexibility (local + optional cloud)
- Neutral, because more complex architecture (dual code paths)
- Bad, because doesn't solve core offline requirement
- Bad, because partial cloud dependency still requires backend infrastructure

### Option 4: No Offline Considerations

- Good, because simplest development approach
- Bad, because unusable in field environments
- Bad, because network issues break application
- Bad, because incompatible with professional instrumentation requirements

## More Information

### Service Worker Implementation

**Caching Strategy:**

- **App Shell (Cache-First)**: HTML, CSS, JS bundles cached on install
- **Static Assets (Cache-First)**: Fonts, icons, images cached permanently
- **Workbox**: Consider Workbox for production-grade caching strategies
- **Versioning**: Cache name includes version number (`sdr-v1.2.0`)

```typescript
// public/sw.js
const CACHE_VERSION = "sdr-v1.2.0";
const CACHE_NAME = `${CACHE_VERSION}-static`;

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/src/main.tsx",
  "/src/main.css",
  "/assets/fonts/inter-v1.woff2",
  "/assets/fonts/jetbrains-mono-v1.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        );
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).then((response) => {
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
      );
    }),
  );
});
```

### PWA Manifest

```json
{
  "name": "WebSDR Pro - Professional Signal Analysis",
  "short_name": "WebSDR Pro",
  "description": "Browser-based Software Defined Radio with hardware-accelerated DSP and research-grade visualizations",
  "start_url": "/",
  "display": "standalone",
  "orientation": "landscape",
  "background_color": "oklch(0.12 0.01 240)",
  "theme_color": "oklch(0.55 0.18 240)",
  "categories": ["utilities", "productivity", "education"],
  "icons": [
    {
      "src": "/icons/icon-72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop-spectrum.png",
      "sizes": "1920x1080",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshots/mobile-interface.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

### Offline Status Detection

```typescript
// src/hooks/use-online-status.ts
import { useState, useEffect } from "react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        toast.success("Connection restored");
        setWasOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      toast.info("Working offline - all features available");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  return isOnline;
}
```

### Storage Integration

Works with ADR-0005 (Storage Strategy):

- **IndexedDB**: All recordings and exports stored locally
- **spark.kv**: Configuration and state persisted locally
- **Cache API**: Static assets cached via Service Worker
- **File System Access API**: Optional export to native filesystem

No network APIs or cloud storage—everything local.

### Update Strategy

```typescript
// src/lib/sw-update-manager.ts
export class ServiceWorkerUpdateManager {
  async checkForUpdates() {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  }

  onUpdateAvailable(callback: () => void) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (this.refreshing) return;
      this.refreshing = true;
      callback();
    });
  }

  async applyUpdate() {
    const registration = await navigator.serviceWorker.ready;
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }

  private refreshing = false;
}
```

### Testing Offline Capability

1. Chrome DevTools: Application > Service Workers > Offline checkbox
2. Network throttling: Simulate slow/offline conditions
3. Lighthouse PWA audit: Verify offline functionality
4. Manual test: Disable network, reload app, verify full functionality

### Browser Compatibility

- Service Workers: Chrome 40+, Firefox 44+, Safari 11.1+, Edge 17+
- PWA Manifest: Chrome 39+, Firefox (limited), Safari 13+, Edge 79+
- Coverage: ~95% of target browsers (desktop), ~85% mobile

### References

#### W3C Standards and Specifications

- [Service Worker API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) - Official W3C Service Worker specification
- [Progressive Web Apps - web.dev](https://web.dev/progressive-web-apps/) - Google's comprehensive PWA guide

#### Academic Research and Case Studies

- "Offline-first PWA: Case Study on Efficient Data Handling and Synchronization." International Journal of Scientific Research in Computer Science, Engineering and Information Technology (2025). [Research Paper](https://ijsrcseit.com/home/issue/view/article.php?id=CSEIT25112782) - Empirical study showing performance improvements with offline-first strategies
- "Progressive Web Apps Development: Offline-First Strategies and Service Worker Implementation." Johal.in (2026). [Technical Guide](https://johal.in/progressive-web-apps-development-offline-first-strategies-and-service-worker-implementation-for-2026/) - Best practices for offline-first architecture
- "Building High-Performance Progressive Web Apps (PWA)." Research Blog (2024). [Case Study](https://www.balajiudayagiri.dev/research-blogs/pwa-introduction-001) - PWA performance showing 137%+ increase in user engagement

#### Implementation Guides and Best Practices

- "Progressive Web App Tutorial 2025: Service Worker Setup and Offline Capabilities." Mark AI Code (2025). [Tutorial](https://markaicode.com/progressive-web-app-tutorial-2025-service-worker-offline/) - Step-by-step Service Worker implementation
- "Implementing Service Worker Strategies For Offline-first PWAs." PeerDH (2024). [Technical Guide](https://peerdh.com/blogs/programming-insights/implementing-service-worker-strategies-for-offline-first-pwas) - Caching strategies and patterns
- Workbox Documentation - Google's Service Worker library and best practices

#### Related ADRs

- ADR-0005: Storage Strategy for Recordings and State (offline data persistence)
- ADR-0009: State Management Pattern (state persistence for offline capability)
- ADR-0011: Error Handling and Resilience Strategy (offline error recovery)
- [Workbox - Production PWA Library](https://developers.google.com/web/tools/workbox)
- [PWA Manifest Spec](https://w3c.github.io/manifest/)
- [Service Worker Lifecycle](https://web.dev/service-worker-lifecycle/)
- "Going Offline" - Jeremy Keith (A Book Apart)
- ADR-0005: Storage Strategy for Recordings and State (IndexedDB integration)
