/**
 * Netgain Ads — Hardened Credential Cryptography Service
 * Uses AES-256-GCM (Authenticated Encryption with Associated Data)
 * Output Format: iv:authTag:ciphertext (hex-encoded)
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12       // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16 // 128-bit authentication tag

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Crypto Ads] CRITICAL: ENCRYPTION_KEY is required in production environment.')
    }
    console.warn('[Crypto Ads] Warning: ENCRYPTION_KEY missing. Using fallback dev secret.')
    return crypto.createHash('sha256').update('netgain-dev-fallback-encryption-secret-32b').digest()
  }
  return crypto.createHash('sha256').update(secret).digest()
}

/**
 * Encrypts sensitive credentials (OAuth tokens, API keys) using AES-256-GCM
 */
export function encryptCredential(plaintext: string): string {
  if (!plaintext) return ''
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex')
  ciphertext += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`
}

/**
 * Decrypts AES-256-GCM encrypted credentials with tamper-detection verification.
 * Also supports legacy AES-256-CBC format (iv:ciphertext) for backward compatibility.
 */
export function decryptCredential(encryptedPayload: string): string {
  if (!encryptedPayload) return ''
  
  const parts = encryptedPayload.split(':')
  
  // 1. AES-256-GCM format (3 parts: iv, authTag, ciphertext)
  if (parts.length === 3) {
    try {
      const iv = Buffer.from(parts[0], 'hex')
      const authTag = Buffer.from(parts[1], 'hex')
      const ciphertext = parts[2]

      if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
        throw new Error('Invalid GCM IV or auth tag length')
      }

      const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv)
      decipher.setAuthTag(authTag)

      let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch (err: any) {
      console.error('[Crypto Ads Decryption Error - GCM]', err.message)
      throw new Error('Decryption failed: integrity check failed or invalid key.')
    }
  }

  // 2. Legacy AES-256-CBC format fallback (2 parts: iv, ciphertext)
  if (parts.length === 2) {
    try {
      const iv = Buffer.from(parts[0], 'hex')
      const ciphertext = parts[1]
      if (iv.length !== 16) return ''

      const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv)
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch (err: any) {
      console.error('[Crypto Ads Decryption Error - CBC Fallback]', err.message)
      return ''
    }
  }

  // If plain unencrypted (e.g. mock token), return as-is
  return encryptedPayload
}
