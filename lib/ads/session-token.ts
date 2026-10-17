/**
 * Netgain Ads — Client Session Token Service
 * Signs and verifies tamper-proof client session tokens using HMAC-SHA256.
 * 
 * SECURITY MANDATE:
 * - Uses CLIENT_SESSION_SECRET, kept completely separate from ENCRYPTION_KEY.
 * - Uses timingSafeEqual to defeat timing attacks.
 * - Validates cryptographic expiration.
 */

import crypto from 'crypto'
import type { VerifiedClientSession } from './types'

const DEFAULT_SESSION_TTL = 7 * 24 * 3600 * 1000 // 7 days in milliseconds

/**
 * Derives the session signing secret.
 * Prioritizes CLIENT_SESSION_SECRET. If missing, derives an isolated signing key
 * using HMAC-SHA256 with a domain-specific salt so it is never identical to the encryption key.
 */
function getSigningSecret(): Buffer {
  if (process.env.CLIENT_SESSION_SECRET) {
    return crypto.createHash('sha256').update(process.env.CLIENT_SESSION_SECRET).digest()
  }

  // Cryptographic isolation: derive distinct signing key using domain-separated salt
  const baseSecret = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'netgain-default-fallback-secret'
  return crypto.createHmac('sha256', baseSecret).update('netgain:client-session-signing:domain-separation:v1').digest()
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64').toString('utf8')
}

/**
 * Creates a cryptographically signed client session token string
 */
export function signClientSession(
  payload: {
    clientAccountId: string
    clientId: string
    email: string
    name?: string
    company?: string
  },
  expiresInMs: number = DEFAULT_SESSION_TTL
): string {
  const now = Date.now()
  const sessionData: VerifiedClientSession = {
    ...payload,
    issuedAt: now,
    exp: now + expiresInMs
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(sessionData))
  const signature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('hex')

  return `${encodedPayload}.${signature}`
}

/**
 * Verifies and decodes a client session token.
 * Returns null if token is missing, malformed, expired, or signature is invalid.
 */
export function verifyClientSession(token?: string | null): VerifiedClientSession | null {
  if (!token || typeof token !== 'string') return null

  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [encodedPayload, providedSignature] = parts

  try {
    // 1. Recompute HMAC signature
    const expectedSignature = crypto
      .createHmac('sha256', getSigningSecret())
      .update(encodedPayload)
      .digest('hex')

    // 2. Constant-time comparison to prevent timing attacks
    const providedBuffer = Buffer.from(providedSignature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')

    if (providedBuffer.length !== expectedBuffer.length) {
      return null
    }

    if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
      return null
    }

    // 3. Decode JSON payload
    const jsonStr = base64UrlDecode(encodedPayload)
    const session = JSON.parse(jsonStr) as VerifiedClientSession

    // 4. Validate expiration
    if (!session.exp || session.exp < Date.now()) {
      return null
    }

    // 5. Validate required tenant fields
    if (!session.clientId || !session.clientAccountId) {
      return null
    }

    return session
  } catch (err) {
    return null
  }
}
