import { createClient } from '@supabase/supabase-js';

// Helper for SHA-256 (required by Meta)
async function hashData(text) {
  if (!text) return null;
  const msgUint8 = new TextEncoder().encode(text.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  if (context.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { request, env } = context;

    // 1. Get Auth Token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // 2. Init Supabase
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    // 3. Validate JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), { status: 401 });
    }

    // 4. Parse request body
    const body = await request.json();
    const { reto_id, event_source_url } = body;
    
    if (!reto_id) {
      return new Response(JSON.stringify({ error: 'Missing reto_id' }), { status: 400 });
    }

    // 5. Server-Side Verification: Ensure user is ACTUALLY enrolled
    const { data: perfil, error: dbError } = await supabase
      .from('perfiles')
      .select('reto_activo_id')
      .eq('id', user.id)
      .single();

    if (dbError || !perfil) {
      return new Response(JSON.stringify({ error: 'Database error or profile not found' }), { status: 500 });
    }

    if (perfil.reto_activo_id !== reto_id) {
      return new Response(JSON.stringify({ error: 'User is not verified to be enrolled in this reto' }), { status: 403 });
    }

    // 6. Meta CAPI Variables
    const PIXEL_ID = env.META_PIXEL_ID;
    const CAPI_TOKEN = env.META_CAPI_TOKEN;
    const TEST_CODE = env.META_TEST_EVENT_CODE;
    
    if (!PIXEL_ID || !CAPI_TOKEN) {
      return new Response(JSON.stringify({ message: 'Meta integration not fully configured, skipped.' }), { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // 7. Prepare Meta Event Data
    const hashedEmail = await hashData(user.email);
    const clientUserAgent = request.headers.get('user-agent') || '';
    // Stable event_id based on reto and user
    const event_id = `${reto_id}:${user.id}`;
    const event_time = Math.floor(Date.now() / 1000);

    const eventData = {
      event_name: "CompleteRegistration",
      event_time: event_time,
      action_source: "website",
      event_id: event_id,
      event_source_url: event_source_url || "https://vetayvigor.app/reto-21-dias",
      user_data: {
        client_user_agent: clientUserAgent,
        em: [hashedEmail]
      }
    };

    const clientIp = request.headers.get('CF-Connecting-IP');
    if (clientIp) {
       eventData.user_data.client_ip_address = clientIp;
    }

    const payload = {
      data: [eventData]
    };

    if (TEST_CODE) {
      payload.test_event_code = TEST_CODE;
    }

    // 8. Fire request to Meta Graph API v25.0
    const metaUrl = `https://graph.facebook.com/v25.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`;
    const metaRes = await fetch(metaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const metaResult = await metaRes.json();

    return new Response(JSON.stringify({ 
      success: true, 
      meta_response: metaResult,
      event_id: event_id
    }), {
      status: metaRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error in CAPI endpoint:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
