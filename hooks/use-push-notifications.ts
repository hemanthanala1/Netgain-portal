'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Convert a URL-safe base64 string to a Uint8Array (needed for VAPID public key)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export type PushNotificationPermission = 'default' | 'granted' | 'denied'

export interface UsePushNotificationsOptions {
  userType: 'admin' | 'client'
  userId: string          // auth UUID for admin, email for client
  clientCompany?: string  // client portal only
  enabled?: boolean       // disable if user not yet logged in
}

export interface UsePushNotificationsReturn {
  permission: PushNotificationPermission
  isSupported: boolean
  isSubscribed: boolean
  isRegistering: boolean
  requestPermission: () => Promise<boolean>
  unsubscribe: () => Promise<void>
}

export function usePushNotifications({
  userType,
  userId,
  clientCompany,
  enabled = true,
}: UsePushNotificationsOptions): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<PushNotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const registeredRef = useRef(false)

  // Check if the Push API is available in this browser
  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window

  // Register the service worker and get the SW registration
  const getSWRegistration = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (!isSupported) return null
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      // Wait for the SW to be ready
      await navigator.serviceWorker.ready
      return reg
    } catch (err) {
      console.warn('[PushNotifications] SW registration failed:', err)
      return null
    }
  }, [isSupported])

  // Save the push subscription to our database via API
  const saveSubscription = useCallback(async (subscription: PushSubscription): Promise<void> => {
    try {
      const res = await fetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userType,
          userId,
          clientCompany: clientCompany || null,
          userAgent: navigator.userAgent.slice(0, 200),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        console.warn('[PushNotifications] Failed to save subscription:', err)
      }
    } catch (err) {
      console.warn('[PushNotifications] Error saving subscription:', err)
    }
  }, [userType, userId, clientCompany])

  // Subscribe this browser to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !userId || registeredRef.current) return false

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey || vapidKey === 'your_vapid_public_key_here') {
      console.warn('[PushNotifications] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set. Skipping push subscription.')
      return false
    }

    setIsRegistering(true)
    try {
      const reg = await getSWRegistration()
      if (!reg) return false

      // Check if already subscribed
      const existingSub = await reg.pushManager.getSubscription()
      if (existingSub) {
        // Already subscribed — re-save to DB in case it was cleared
        await saveSubscription(existingSub)
        setIsSubscribed(true)
        registeredRef.current = true
        return true
      }

      // Create a new push subscription
      const applicationServerKey = urlBase64ToUint8Array(vapidKey)
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any,
      })

      await saveSubscription(subscription)
      setIsSubscribed(true)
      registeredRef.current = true
      return true
    } catch (err: any) {
      // NotAllowedError means the user denied permission
      if (err?.name === 'NotAllowedError') {
        setPermission('denied')
      } else {
        console.warn('[PushNotifications] Subscribe error:', err)
      }
      return false
    } finally {
      setIsRegistering(false)
    }
  }, [isSupported, userId, getSWRegistration, saveSubscription])

  // Request notification permission from the user, then subscribe
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false

    const result = await Notification.requestPermission()
    setPermission(result as PushNotificationPermission)

    if (result === 'granted') {
      return subscribe()
    }
    return false
  }, [isSupported, subscribe])

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported) return
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (!reg) return

      const subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()

        // Remove from DB
        await fetch('/api/push/unregister', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint, userType, userId }),
        })
      }
      setIsSubscribed(false)
      registeredRef.current = false
    } catch (err) {
      console.warn('[PushNotifications] Unsubscribe error:', err)
    }
  }, [isSupported, userType, userId])

  // On mount: sync current permission state and auto-subscribe if already granted
  useEffect(() => {
    if (!isSupported || !enabled || !userId) return

    const currentPermission = Notification.permission as PushNotificationPermission
    setPermission(currentPermission)

    if (currentPermission === 'granted') {
      // Already have permission — silently subscribe/re-sync
      subscribe()
    }
  }, [isSupported, enabled, userId, subscribe])

  return {
    permission,
    isSupported,
    isSubscribed,
    isRegistering,
    requestPermission,
    unsubscribe,
  }
}
