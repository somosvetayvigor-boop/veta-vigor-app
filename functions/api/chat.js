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

    let modelName = env.GEMINI_MODEL_NAME || 'gemini-1.5-pro';
    let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody)
    });

    // Auto-recuperación: Si el modelo falla por nombre obsoleto (404), buscar modelos vivos
    if (!response.ok && response.status === 404) {
      console.log("Modelo no encontrado, intentando auto-recuperación...");
      try {
        const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          // Encontrar un modelo válido (gemini-1.5 o superior)
          const validModel = modelsData.models?.find(m => 
            m.supportedGenerationMethods?.includes('generateContent') && 
            m.name.includes('gemini') && 
            !m.name.includes(modelName) &&
            !m.name.includes('vision')
          );
          
          if (validModel) {
            modelName = validModel.name.replace('models/', '');
            console.log("Reintentando con modelo alternativo:", modelName);
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(geminiBody)
            });
          }
        }
      } catch (e) {
        console.error("Fallo en auto-recuperación:", e);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      return new Response(JSON.stringify({ error: `Gemini falló en responder: ${errorText}` }), { status: 500 });
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No hay respuesta.";

    return new Response(JSON.stringify({ reply: replyText }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error("Error general en el worker:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
