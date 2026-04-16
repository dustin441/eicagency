const { createClient } = require('@supabase/supabase-js');

async function checkSchema() {
  const supabase = createClient(
    process.env.SPARTACO_SUPABASE_URL,
    process.env.SPARTACO_SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('--- Tables ---');
  const { data: tables, error: tableError } = await supabase
    .from('master_product_performance') // Guessing the name
    .select('*')
    .limit(1);

  if (tableError) {
    console.log('Error fetching master_product_performance:', tableError.message);
    // If table doesn't exist, let's look for all tables
    const { data: allTables, error: allTablesError } = await supabase.rpc('get_tables'); // Hope this exists
    if (allTablesError) {
       // Alternative: query public.tables
       console.log('Alternative: trying to select from information_schema');
    }
  } else {
    console.log('Columns in master_product_performance:', Object.keys(tables[0]));
  }
}

// In a real Antigravity environment, I would run this with node
// But I'll just write it and check if I can run it.
