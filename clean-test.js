const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'c:\\Users\\heman\\Downloads\\Netgain Operating Portal\\netgain-portal\\.env.local';
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts[1].trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function clean() {
  const { data, error } = await supabase
    .from('salaries')
    .delete()
    .like('id', 'test-sal-%');

  if (error) {
    console.error('Error cleaning up:', error);
  } else {
    console.log('Cleanup success!');
  }
}

clean();
