// Proxy seguro para enviar push notifications via OneSignal.
//
// Antes, Comunidad.jsx (Zumbido Vigoroso) y AdminChatModal.jsx (aviso de
// mensaje del Coach) llamaban a la API de OneSignal DIRECTO desde el
// cliente, mandando la REST API Key completa en la cabecera Authorization
// (leida de import.meta.env.VITE_ONESIGNAL_API_KEY). Cualquier variable
// VITE_ en este proyecto queda empaquetada dentro del JS del APK -- esa
// clave le daba a cualquiera que descomprimiera el .aab permiso para
// mandar notificaciones push a CUALQUIER usuario de la app, no solo esas
// dos pantallas. Mismo patron que ya usaba functions/api/chat.js para la
// clave de Gemini: la clave real vive solo acá, del lado servidor
// (env.ONESIGNAL_REST_API_KEY, SIN prefijo VITE_ para que Vite nunca la
// empaquete -- ya estaba configurada en Cloudflare Pages con ese nombre,
// solo hacia falta que el codigo la leyera), y el cliente le manda a
// esta funcion en vez de a OneSignal directo.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ONESIGNAL_APP_ID = 'f0e7f7a8-6da8-4592-92a7-542f731a91f0';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return onRequestPost(context);
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { externalUserId, heading, content, data } = await request.json();

    if (!externalUserId || !content) {
      return new Response(JSON.stringify({ error: 'Faltan externalUserId o content.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const API_KEY = env.ONESIGNAL_REST_API_KEY;
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: 'ONESIGNAL_REST_API_KEY no configurada en el servidor.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const osResponse = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_aliases: { external_id: [externalUserId] },
        target_channel: 'push',
        headings: { en: heading, es: heading },
        contents: { en: content, es: content },
        ...(data ? { data } : {})
      })
    });

    const osResult = await osResponse.json();

    if (!osResponse.ok || osResult.errors) {
      console.error('OneSignal error:', JSON.stringify(osResult));
      return new Response(JSON.stringify({ error: osResult.errors || 'Error enviando notificación.' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({ success: true, recipients: osResult.recipients ?? null }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error en onesignal-notify:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
