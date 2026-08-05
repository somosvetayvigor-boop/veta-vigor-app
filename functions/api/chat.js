const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return onRequestPost(context);
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    
    const userMessage = body.message;
    const userLevel = body.nivel || 'Semilla';
    
    // Convertimos el historial de la base de datos al formato de Gemini
    const rawHistory = body.history || [];
    const geminiHistory = rawHistory.map(msg => ({
      role: msg.role === 'coach' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

    const API_KEY = env.GEMINI_API_KEY || "YOUR_API_KEY_HERE";

    // El Prompt Secreto del Head Coach
    const systemInstruction = `Eres el Head Coach virtual de la aplicación 'Veta & Vigor'. Tu tono es estricto, disciplinado, altamente motivador, enfocado totalmente en el alto rendimiento, la hipertrofia y el entrenamiento de fuerza. 
Reglas absolutas que debes cumplir:
1. No respondas preguntas de temas que no sean entrenamiento físico, nutrición deportiva, descanso o mentalidad de atleta. Si te preguntan algo fuera de eso, diles que dejen de perder el tiempo y vayan a entrenar.
2. Si te piden que recomiendes una rutina, SOLO puedes recomendar las rutinas oficiales de Veta & Vigor.
3. CRÍTICO: El usuario con el que estás hablando está en el Nivel "${userLevel}". NUNCA le recomiendes una rutina de un nivel superior. Las rutinas disponibles en la app según el nivel son:
   - Semilla y Pino: Solo rutinas de "Cuerpo Completo" (3 días a la semana).
   - Tzalam y Roble: Solo rutinas "Torso" e "Inferior" (4 días a la semana).
   Si te piden una rutina que no está en la app para su nivel, diles firmemente que sigan el programa oficial que se les asignó.
4. Mantén tus respuestas concisas (máximo 2 o 3 párrafos cortos) y legibles usando listas si es necesario.`;

    // Añadimos el nuevo mensaje del usuario al historial
    const contents = [...geminiHistory, { role: "user", parts: [{ text: userMessage }] }];

    const geminiBody = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: contents,
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
      }
    };

    const candidateModels = [
      env.GEMINI_MODEL_NAME,
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
      'gemini-2.0-flash',
      'gemini-pro'
    ].filter(Boolean);

    let response = null;

    // 1. Probar la lista de modelos candidatos más rápidos y modernos
    for (const model of candidateModels) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody)
        });
        if (res.ok) {
          response = res;
          break;
        } else if (res.status !== 404 && !response) {
          response = res;
        }
      } catch (e) {
        console.error(`Error intentando modelo ${model}:`, e);
      }
    }

    // 2. Si ninguno de los candidatos funcionó, consultar la API de modelos disponibles en Google y probar uno por uno
    if (!response || !response.ok) {
      console.log("Ningún candidato local funcionó, probando catálogo oficial de Google...");
      try {
        const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          const liveModels = (modelsData.models || [])
            .filter(m => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini') && !m.name.includes('vision'))
            .map(m => m.name.replace('models/', ''));

          for (const liveModel of liveModels) {
            if (candidateModels.includes(liveModel)) continue;
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${liveModel}:generateContent?key=${API_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(geminiBody)
            });
            if (res.ok) {
              response = res;
              break;
            }
          }
        }
      } catch (e) {
        console.error("Fallo al consultar lista de modelos:", e);
      }
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "No se pudo contactar a ningún modelo de Gemini.";
      console.error("Gemini API Error:", errorText);
      return new Response(JSON.stringify({ error: `Gemini falló en responder: ${errorText}` }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No hay respuesta.";

    return new Response(JSON.stringify({ reply: replyText }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    console.error("Error general en el worker:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
