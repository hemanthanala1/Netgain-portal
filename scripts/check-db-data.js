const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
let supabaseUrl = '';
let supabaseServiceKey = '';

try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
          supabaseUrl = value;
        } else if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
          supabaseServiceKey = value;
        }
      }
    });
  }
} catch (e) {
  console.error('Error reading env file:', e);
}

if (!supabaseUrl || !supabaseServiceKey) {
  // Try fallback to process.env
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`;
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase credentials not configured in env variables.', { supabaseUrl, hasKey: !!supabaseServiceKey });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  try {
    console.log('--- 1. Client Accounts ---');
    const { data: accounts, error: accErr } = await supabase.from('client_accounts').select('*');
    if (accErr) console.error(accErr);
    else console.log(accounts);

    console.log('\n--- 2. CRM Clients ---');
    const { data: clients, error: cliErr } = await supabase.from('crm_clients').select('*');
    if (cliErr) console.error(cliErr);
    else console.log(clients);

    console.log('\n--- 3. Quotations ---');
    const { data: quos, error: quoErr } = await supabase.from('quotations').select('*');
    if (quoErr) console.error(quoErr);
    else console.log(quos.map(q => ({ id: q.id, doc_id: q.doc_id, client: q.client, email: q.email, status: q.status })));

    console.log('\n--- 4. SOWs ---');
    const { data: sows, error: sowErr } = await supabase.from('sows').select('*');
    if (sowErr) console.error(sowErr);
    else console.log(sows.map(s => ({ id: s.id, doc_id: s.doc_id, client: s.client, status: s.status })));

  } catch (err) {
    console.error(err);
  }
}

run();
