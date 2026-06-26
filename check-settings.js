const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

// Parse env file manually
try {
  const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/)
    if (match) {
      const key = match[1]
      let value = match[2] || ''
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      process.env[key] = value
    }
  })
} catch (e) {
  console.warn('Could not load .env.local', e)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16

function getKey() {
  const secret = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'netgain-default-fallback-encryption-secret-key-32b'
  return crypto.createHash('sha256').update(secret).digest()
}

function decrypt(encryptedText) {
  if (!encryptedText) return ''
  try {
    if (!encryptedText.includes(':')) {
      return encryptedText
    }
    const parts = encryptedText.split(':')
    if (parts.length !== 2) return encryptedText
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    
    if (iv.length !== IV_LENGTH) return encryptedText

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    return 'DECRYPTION_ERROR: ' + err.message
  }
}

async function run() {
  const { data, error } = await supabase.from('company_settings').select('*')
  if (error || !data || data.length === 0) {
    console.error('No settings loaded')
    return
  }

  const decryptedAuthkey = decrypt(data[0].comm?.msg91Authkey || '')
  console.log('Real key from DB:', decryptedAuthkey)

  const url = 'https://control.msg91.com/api/v5/flow/'

  // Test 1: Real key from DB
  console.log('\n--- Test 1: Real key from DB ---')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authkey: decryptedAuthkey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template_id: 'dummy_template_id',
        recipients: [
          {
            mobiles: '919999999999'
          }
        ]
      })
    })
    const text = await res.text()
    console.log('Status:', res.status)
    console.log('Body:', text)
  } catch (err) {
    console.error('Error:', err.message)
  }

  // Test 2: Invalid/Dummy key
  console.log('\n--- Test 2: Invalid/Dummy key ---')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authkey: 'dummy_invalid_key_123',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template_id: 'dummy_template_id',
        recipients: [
          {
            mobiles: '919999999999'
          }
        ]
      })
    })
    const text = await res.text()
    console.log('Status:', res.status)
    console.log('Body:', text)
  } catch (err) {
    console.error('Error:', err.message)
  }
}

run()
