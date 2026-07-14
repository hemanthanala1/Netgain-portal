const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  const password = process.argv[2];

  if (!password) {
    console.log('\n============================================================');
    console.log('GOOGLE DRIVE MODULE DATABASE MIGRATION SCRIPT');
    console.log('============================================================');
    console.log('You can apply the SQL schema in two ways:');
    console.log('\nOPTION A (Recommended):');
    console.log('Copy the contents of the SQL schema file below and paste them into');
    console.log('the Supabase SQL Editor in your dashboard (https://supabase.com):');
    console.log(`\n👉 File: ${path.resolve(__dirname, '../supabase/google_drive_schema.sql')}`);
    console.log('\nOPTION B (Direct CLI execution):');
    console.log('Run this script again providing your Supabase database password:');
    console.log('  node scripts/apply-google-drive-db.js <your_database_password>');
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
  const schemaSql = fs.readFileSync(path.join(__dirname, '../supabase/google_drive_schema.sql'), 'utf8');

  // Supabase connection string format
  const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.oizlgmtlzohfljwnxpsk.supabase.co:5432/postgres`;
  const client = new Client({ connectionString });

  try {
    console.log('Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('Successfully connected! Applying Google Drive integration SQL migrations...');
    await client.query(schemaSql);
    console.log('Google Drive SQL migrations applied successfully!');
  } catch (err) {
    console.error('Failed to apply SQL migrations:', err.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
