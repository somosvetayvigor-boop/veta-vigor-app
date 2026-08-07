import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
  const { request, env } = context;

  // 1. Autorización de Contingencia / Cron
  const authHeader = request.headers.get('Authorization');
  const expectedSecret = env.CRON_SECRET || 'secret-vigor-21';
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const TEST_MODE = env.TEST_MODE === 'true';
  const logs = [];
  const addLog = (msg) => logs.push(msg);

  addLog(`Iniciando Motor Push Reto 21... TEST_MODE: ${TEST_MODE}`);

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY);

  // Helper para zona horaria
  const now = new Date();
  const mexicoTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
  
  const currentMonth = mexicoTime.getMonth() + 1; // 1-12
  const currentDate = mexicoTime.getDate(); // 1-31
  const currentHour = mexicoTime.getHours(); // 0-23
  
  // Formato YYYY-MM-DD local
  const todayStr = `${mexicoTime.getFullYear()}-${String(currentMonth).padStart(2, '0')}-${String(currentDate).padStart(2, '0')}`;

  addLog(`Hora CDMX: ${todayStr} ${currentHour}:00`);

  // 2. Traer a los inscritos (usuarios que tienen un reto activo)
  const { data: inscritos, error: insError } = await supabase
    .from('perfiles')
    .select('id')
    .not('reto_activo_id', 'is', null);

  if (insError) {
    addLog(`Error obteniendo inscritos: ${insError.message}`);
    return new Response(JSON.stringify({ logs }), { status: 500 });
  }

  const usersList = inscritos || [];
  const userIds = usersList.map(u => u.id);
  addLog(`Atletas activos encontrados: ${userIds.length}`);

  if (userIds.length === 0) {
    return new Response(JSON.stringify({ logs, message: 'Nadie inscrito.' }), { status: 200 });
  }

  // --- REGLAS DE NEGOCIO ---
  const sendPush = async (segmentIds, titulo, mensaje, link, tipoMensaje) => {
    if (segmentIds.length === 0) return 0;

    addLog(`Intentando enviar [${tipoMensaje}] a ${segmentIds.length} usuarios.`);

    // Idempotencia: Filtrar los que ya lo recibieron
    const { data: yaEnviados } = await supabase
      .from('push_logs')
      .select('user_id')
      .eq('tipo_mensaje', tipoMensaje)
      .in('user_id', segmentIds);

    const sentIds = (yaEnviados || []).map(r => r.user_id);
    const aEnviar = segmentIds.filter(id => !sentIds.includes(id));

    if (aEnviar.length === 0) {
      addLog(`Todos ya recibieron [${tipoMensaje}]. Saltando.`);
      return 0;
    }

    let successCount = 0;

    // Enviar vía OneSignal
    if (!TEST_MODE && env.ONESIGNAL_APP_ID && env.ONESIGNAL_REST_API_KEY) {
      try {
        const payload = {
          app_id: env.ONESIGNAL_APP_ID,
          include_external_user_ids: aEnviar,
          headings: { "en": titulo, "es": titulo },
          contents: { "en": mensaje, "es": mensaje },
          url: link // Deep link (App/PWA lo maneja si se envía bien)
        };

        const res = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${env.ONESIGNAL_REST_API_KEY}`
          },
          body: JSON.stringify(payload)
        });
        
        const osResult = await res.json();
        if (osResult.errors) {
          addLog(`OneSignal Error: ${JSON.stringify(osResult.errors)}`);
        } else {
          successCount = aEnviar.length;
        }
      } catch (err) {
        addLog(`OneSignal Fetch Error: ${err.message}`);
      }
    } else {
      addLog(`[TEST MODE o Faltan APIs] Simulación exitosa a ${aEnviar.length} usuarios.`);
      successCount = aEnviar.length;
    }

    // Guardar logs para idempotencia
    if (successCount > 0) {
      const inserts = aEnviar.map(id => ({
        user_id: id,
        tipo_mensaje: TEST_MODE ? `test_${tipoMensaje}` : tipoMensaje,
        status: 'sent'
      }));
      await supabase.from('push_logs').insert(inserts);
      addLog(`Logs guardados para [${tipoMensaje}].`);
    }

    return successCount;
  };

  // REGLA 1: CONFIRMACIÓN DE INSCRIPCIÓN
  // Evalúa a todos los inscritos. Quien no tenga el log 'inscripcion_confirmada', lo recibe.
  await sendPush(
    userIds,
    "Tu lugar está confirmado",
    "Entra a La Forja y prepárate para comenzar el 10 de agosto.",
    "https://pro.vetayvigor.com/reto-21-dias",
    "inscripcion_confirmada"
  );

  // REGLA 2: FALTAN 3 DÍAS (7 Ago, 09:00+)
  if (currentMonth === 8 && currentDate === 7 && currentHour >= 9) {
    await sendPush(
      userIds, 
      "Faltan 3 días", 
      "Revisa tu Madera, prepara tu espacio y activa tus notificaciones.", 
      "https://pro.vetayvigor.com/reto-21-dias", 
      "faltan_3_dias"
    );
  }

  // REGLA 3: MAÑANA COMENZAMOS (9 Ago, 20:00+)
  if (currentMonth === 8 && currentDate === 9 && currentHour >= 20) {
    await sendPush(
      userIds, 
      "Mañana comenzamos", 
      "Descansa. Tu primera Misión estará lista al iniciar el día.", 
      "https://pro.vetayvigor.com/reto-21-dias", 
      "manana_empezamos"
    );
  }

  // REGLA 4: EMPEZAMOS (10 Ago, 00:00+)
  if (currentMonth === 8 && currentDate === 10) {
    await sendPush(
      userIds, 
      "EMPEZAMOS", 
      "Tu primera Misión del Reto Vigor 21 ya está lista.", 
      "https://pro.vetayvigor.com/reto-21-dias", 
      "empezamos"
    );
  }

  // REGLA 5: MISIÓN PENDIENTE (Diario a partir de las 19:00 durante el reto)
  // El reto es del 10 al 30 de agosto (21 días)
  if (currentMonth === 8 && currentDate >= 10 && currentDate <= 30 && currentHour >= 19) {
    // Buscar quién ya hizo checkin hoy
    const { data: checkinsHoy } = await supabase
      .from('checkins')
      .select('user_id')
      .eq('fecha', todayStr)
      .in('user_id', userIds);

    const usersConCheckin = (checkinsHoy || []).map(c => c.user_id);
    const usersSinCheckin = userIds.filter(id => !usersConCheckin.includes(id));

    await sendPush(
      usersSinCheckin,
      "Tu Misión sigue disponible",
      "Todavía puedes presentarte y completar tu registro.",
      "https://pro.vetayvigor.com/",
      `mision_pendiente_${todayStr}`
    );
  }

  addLog('Evaluación terminada.');

  return new Response(JSON.stringify({ success: true, logs }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
