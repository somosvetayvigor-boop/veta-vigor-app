import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const url = 'https://rhxseahupujjqhcrthpf.supabase.co';
const key = 'sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from('perfiles')
    .select('plan_membresia, chat_bloqueado, usuarios_silenciados, reto_activo_id, reto_completado')
    .eq('email', 'astrolabiobooks@gmail.com')
    .single();

  if (error) {
    console.log("DB ERROR:", error);
    return;
  }

  const planActual = data?.plan_membresia || 'Atleta Base (Gratis)';
  const estaEnReto = data?.reto_activo_id ? true : false;
  const retoTerminado = data?.reto_completado === true;
  const esSuscritoBase = ['Socio Argentum', 'Socio Aurum'].includes(planActual);
  const isEntrenador = false;

  const tieneAcceso = planActual?.includes('Pro') || planActual?.includes('Élite') || planActual === 'Socio Fundador Vitalicio' || planActual === 'Plan Platinum' || planActual === 'Prueba Gratis (7 Días)' || planActual.toLowerCase().includes('administrador') || estaEnReto || isEntrenador || (esSuscritoBase && retoTerminado);

  console.log("data:", data);
  console.log("planActual:", planActual);
  console.log("estaEnReto:", estaEnReto);
  console.log("tieneAcceso:", tieneAcceso);
}
run();
