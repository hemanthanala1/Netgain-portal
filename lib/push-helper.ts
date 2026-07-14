/**
 * Send a push notification to a target via the /api/push/send route.
 * This is a fire-and-forget call — it never throws, just warns on failure.
 *
 * @param targetType  'all_admins' | 'client' | 'company'
 * @param targetId    For 'client': email. For 'company': company name. Not needed for 'all_admins'.
 * @param title       Notification title (emoji will be prepended by service worker based on type)
 * @param body        Notification body text (max ~120 chars recommended)
 * @param options     Optional: url, type, tag
 */
export async function sendPushNotification(
  targetType: 'all_admins' | 'client' | 'company',
  targetId: string | undefined,
  title: string,
  body: string,
  options?: {
    url?: string
    type?: 'support' | 'document' | 'file' | 'requirement' | 'meeting' | 'payment' | 'success' | 'warning' | 'info'
    tag?: string
    notifId?: string
  }
): Promise<void> {
  try {
    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetType,
        targetId,
        payload: {
          title,
          body,
          url: options?.url || '/',
          type: options?.type || 'info',
          tag: options?.tag || `netgain-${Date.now()}`,
          notifId: options?.notifId,
        },
      }),
    })
  } catch (err) {
    console.warn('[sendPushNotification] Failed silently:', err)
  }
}
