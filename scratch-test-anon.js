const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables
const envPath = 'c:\\Users\\heman\\Downloads\\Netgain Operating Portal\\netgain-portal\\.env.local';
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts[1].trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // USE ANON KEY

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log('Testing insert into salaries using ANON key...');
  const { data: salData, error: salErr } = await supabase
    .from('salaries')
    .insert([{
      id: 'test-sal-anon-' + Date.now(),
      employee: 'Test Employee Anon',
      role: 'Developer',
      base_salary: 5000,
      bonus: 500,
      status: 'pending',
      date: new Date().toISOString().slice(0, 10)
    }]);

  if (salErr) {
    console.error('Error inserting into salaries:', salErr);
  } else {
    console.log('Successfully inserted into salaries! data:', salData);
  }
}

testInsert();
