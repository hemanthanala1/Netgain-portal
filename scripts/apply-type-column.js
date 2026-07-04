const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  const password = process.argv[2];

  if (!password) {
    console.log('\n============================================================');
    console.log('SUPABASE DATABASE MIGRATION SCRIPT - ADD TYPE COLUMN');
    console.log('============================================================');
    console.log('You can apply this SQL migration in two ways:');
    console.log('\nOPTION A (Recommended):');
    console.log('Copy and paste the following SQL query into the Supabase SQL Editor');
    console.log('in your dashboard (https://supabase.com):');
    console.log('\n  ALTER TABLE public.client_notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT \'support\';');
    console.log('\nOPTION B (Direct CLI execution):');
    console.log('Run this script again providing your Supabase database password:');
    console.log('  node scripts/apply-type-column.js <your_database_password>');
    console.log('============================================================\n');
    return;
  }

  console.log('Checking for pg (postgres client)...');
  try {
    require.resolve('pg');
  } catch (e) {
    console.log('pg is not installed. Installing pg dynamically...');
    execSync('npm install pg --no-save', { stdio: 'inherit' });
  }

  const { Client } = require('pg');

  // Supabase connection string format
  const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.oizlgmtlzohfljwnxpsk.supabase.co:5432/postgres`;
  const client = new Client({ connectionString });

  try {
    console.log('Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('Successfully connected! Adding type column...');
    await client.query("ALTER TABLE public.client_notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'support';");
    console.log('Successfully added "type" column to client_notifications table!');
  } catch (err) {
    console.error('Failed to apply migration:', err.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
