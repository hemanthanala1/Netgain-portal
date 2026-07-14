// Netgain Operating Portal — Service Worker
// Handles Web Push notifications (WhatsApp-style OS alerts)

const CACHE_NAME = 'netgain-portal-v1'

// ─── Install & Activate ─────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  // Skip waiting so the new SW activates immediately
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

// ─── Push Event ─────────────────────────────────────────────────────────────
// Fired when the server sends a push message via web-push

self.addEventListener('push', (event) => {
  let data = {
    title: 'Netgain Portal',
    body: 'You have a new notification.',
    url: '/',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    tag: 'netgain-notif',
    type: 'info'
  }

  // Parse the push payload (JSON sent from /api/push/send)
  if (event.data) {
    try {
      const parsed = event.data.json()
      data = { ...data, ...parsed }
    } catch {
      data.body = event.data.text()
    }
  }

  // Map notification type to an emoji prefix for visual flair
  const typeEmoji = {
    support: '🎫',
    document: '📄',
    file: '📁',
    requirement: '📋',
    meeting: '📅',
    payment: '💳',
    success: '✅',
    warning: '⚠️',
    info: 'ℹ️'
  }[data.type] || '🔔'

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-72.png',
    tag: data.tag || `netgain-${Date.now()}`,
    // Reuse the same tag to replace repeated notifications of same type
    renotify: true,
    // Keep the notification visible until the user interacts
    requireInteraction: false,
    // WhatsApp-style vibration pattern: buzz-pause-buzz
    vibrate: [200, 100, 200],
    // Store the URL to navigate to on click
    data: {
      url: data.url || '/',
      notifId: data.notifId || null
    },
    actions: [
      {
        action: 'open',
        title: 'Open Portal'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    // Silent: false — let the OS play the default notification sound
    silent: false,
    // Timestamp for ordering
    timestamp: Date.now()
  }

  // Prepend the type emoji to the title
  const title = `${typeEmoji} ${data.title}`

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// ─── Notification Click ──────────────────────────────────────────────────────
// When user clicks the notification or an action button

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') {
    // User dismissed — just close, do nothing
    return
  }

  // Get the URL from the notification data
  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open for this portal
      for (const client of windowClients) {
        // If we find an open tab for our portal, focus it and navigate
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(targetUrl)
          return
        }
      }
      // Otherwise, open a new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})

// ─── Notification Close ──────────────────────────────────────────────────────

self.addEventListener('notificationclose', (event) => {
  // Optional: log that user dismissed the notification
  // Can be used for analytics in the future
})

// ─── Push Subscription Change ────────────────────────────────────────────────
// Fired when the browser automatically rotates push keys (rare but important)

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription
        ? event.oldSubscription.options.applicationServerKey
        : null
    }).then((subscription) => {
      // Re-register the new subscription
      return fetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userType: 'admin', // Will be overridden by stored value if needed
          resubscribe: true
        })
      })
    })
  )
})
