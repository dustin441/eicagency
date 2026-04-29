import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const envCheck = {
    url_set: !!url,
    url_value: url ?? 'MISSING',
    key_set: !!key,
    key_prefix: key ? key.substring(0, 20) + '...' : 'MISSING',
  };

  try {
    const supabase = createServerSupabaseClient();

    // Run the simplest possible query on MMP
    const { data, error, count } = await supabase
      .from('master_marketing_performance')
      .select('date, platform, spend', { count: 'exact' })
      .gte('date', '2026-03-29')
      .lte('date', '2026-04-28')
      .limit(3);

    return NextResponse.json({
      env: envCheck,
      query: {
        error: error ? { message: error.message, code: error.code, hint: error.hint } : null,
        row_count: count,
        sample_rows: data ?? [],
      },
    });
  } catch (e) {
    return NextResponse.json({
      env: envCheck,
      thrown: String(e),
    }, { status: 500 });
  }
}
