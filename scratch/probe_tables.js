const { createClient } = require('@supabase/supabase-js');

async function listTables() {
  const supabase = createClient(
    'https://lozgnyxixzfxokllevtb.supabase.co',
    process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY // I need to get this from .env.local
  );

  // We can't easily list tables via JS client without an RPC or information_schema select.
  // But we can try to select from a common table or use a query that fails with a list of suggestions? 
  // Actually, I'll try to select from 'master_product_performance' directly since that's a likely name.
  
  const { data, error } = await supabase.from('master_product_performance').select('*').limit(1);
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Success! Columns:', Object.keys(data[0]));
  }
}
