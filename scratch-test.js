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
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log('Testing insert into expenses with tax_amount...');
  const { data: expData, error: expErr } = await supabase
    .from('expenses')
    .insert([{
      id: 'test-exp-' + Date.now(),
      title: 'Test Expense',
      category: 'Operations',
      amount: 100,
      tax_amount: 18,
      status: 'pending',
      date: new Date().toISOString().slice(0, 10)
    }]);

  if (expErr) {
    console.error('Error inserting into expenses with tax_amount:', expErr);
  } else {
    console.log('Successfully inserted into expenses! data:', expData);
  }

  console.log('Testing insert into salaries...');
  const { data: salData, error: salErr } = await supabase
    .from('salaries')
    .insert([{
      id: 'test-sal-' + Date.now(),
      employee: 'Test Employee',
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
