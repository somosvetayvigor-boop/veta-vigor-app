import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronLeft, Key, FileText, Gift, Loader, Shield, Flame, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getGolpesTotales, getGolpesDisponibles, getGolemData } from '../utils/ProgressionEngine';
import GolemAnimado from '../components/GolemAnimado';

export default function LaPrueba({ session }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [isHit, setIsHit] = useState(false);
  const [monedas, setMonedas] = useState(0);
  const [xp, setXp] = useState(0);
  const [inventario, setInventario] = useState({ ficha_reposo: 0, anima_bosque: 0, borde_fuego: 0 });
  const [toast, setToast] = useState({ show: false, message: '' });
  const [confirmAction, setConfirmAction] = useState({ show: false, itemId: null, precio: 0, esPermanente: false });
  const [golem, setGolem] = useState({ golpes_utilizados: 0, golem_vencido: false, golem_nivel: 1 });

  const currentGolemData = getGolemData(golem.golem_nivel || 1);

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3500);
  };

  const loadDatos = async () => {
    if (!session?.user) return;
    try {
      // Perfil (XP y Monedas)
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('puntos_forja, xp_actual')
        .eq('id', session.user.id)
        .single();
        
      if (perfil) {
        setMonedas(perfil.monedas_forja ?? perfil.puntos_forja ?? 0); // Fallback a puntos_forja antiguo
        setXp(perfil.xp_actual || 0);
      }

      // Inventario
      const { data: inv } = await supabase
        .from('rpg_inventario')
        .select('item_id, cantidad')
        .eq('user_id', session.user.id);
        
      if (inv) {
        const invMap = { ficha_reposo: 0, anima_bosque: 0, borde_fuego: 0 };
        inv.forEach(i => invMap[i.item_id] = i.cantidad);
        setInventario(invMap);
      }

      // Golem
      const { data: gol } = await supabase
        .from('golem_progreso')
        .select('golpes_utilizados, golem_vencido, golem_nivel')
        .eq('user_id', session.user.id)
        .single();
        
      if (gol) setGolem(gol);

    } catch (err) {
      console.error('Error cargando forja:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatos();
  }, [session]);

  const atacarGolem = async () => {
    if (golem.golem_vencido) return;
    const disponibles = getGolpesDisponibles(xp, golem.golpes_utilizados);
    if (disponibles <= 0) {
      showToast("No tienes Golpes de Vigor disponibles. Acumula 25 XP para obtener uno.");
      return;
    }

    setProcesando(true);
    try {
      const idempotencyKey = Date.now().toString(36) + Math.random().toString(36).substring(2);
      const { data, error } = await supabase.rpc('atacar_golem', {
        p_user_id: session.user.id,
        p_idempotency_key: idempotencyKey
      });

      if (error) throw error;
      if (!data.success) {
        showToast(data.error);
      } else {
        setIsHit(true);
        setTimeout(async () => {
          setIsHit(false);
          if (data.golem_muerto) {
            showToast(`¡HAS VENCIDO A ${currentGolemData.nombre.toUpperCase()}! Has ganado ${data.recompensa} Monedas.`);
            await loadDatos(); // Recargar para ver si avanzamos al siguiente nivel
          } else {
            showToast(`¡Golpe asestado! Al Gólem le queda ${data.golpes_restantes_vida} de vida.`);
          }
          await loadDatos();
        }, 400);
      }
    } catch (err) {
      showToast("Error al atacar al Gólem.");
      console.error(err);
    } finally {
      setProcesando(false);
    }
  };

  const iniciarCompra = (itemId, precio, esPermanente) => {
    if (monedas < precio) {
      showToast("No tienes suficientes Monedas de Forja.");
      return;
    }

    if (itemId === 'ficha_reposo' && inventario.ficha_reposo >= 2) {
      showToast("Ya tienes el máximo de 2 Fichas de Reposo.");
      return;
    }

    if (esPermanente && inventario[itemId] > 0) {
      showToast("Ya posees este ítem permanentemente.");
      return;
    }

    setConfirmAction({ show: true, itemId, precio, esPermanente });
  };

  const cancelarCompra = () => {
    setConfirmAction({ show: false, itemId: null, precio: 0, esPermanente: false });
  };

  const ejecutarCompra = async () => {
    setProcesando(true);
    const { itemId, precio, esPermanente } = confirmAction;
    setConfirmAction({ show: false, itemId: null, precio: 0, esPermanente: false });
    
    try {
      const idempotencyKey = Date.now().toString(36) + Math.random().toString(36).substring(2);
      const { data, error } = await supabase.rpc('comprar_item_rpg', {
        p_user_id: session.user.id,
        p_item_id: itemId,
        p_precio: precio,
        p_es_permanente: esPermanente,
        p_idempotency_key: idempotencyKey
      });

      if (error) throw error;
      if (!data.success) {
        showToast(data.error);
      } else {
        showToast("¡Adquisición exitosa!");
        await loadDatos();
      }
    } catch (err) {
      showToast("Error en la transacción.");
      console.error(err);
    } finally {
      setProcesando(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-dark)', color: 'var(--accent-gold)' }}>
        <Loader className="spin" size={32} />
      </div>
    );
  }

  const avanzarGolem = async () => {
    setProcesando(true);
    try {
      const nextLevel = (golem.golem_nivel || 1) + 1;
      const { error } = await supabase
        .from('golem_progreso')
        .update({
          golem_nivel: nextLevel,
          golem_vencido: false,
          golpes_utilizados: 0
        })
        .eq('user_id', session.user.id);

      if (error) throw error;
      
      showToast(`¡Has avanzado al Gólem Nv. ${nextLevel}!`);
      await loadDatos();
    } catch (err) {
      showToast("Error al avanzar de Gólem.");
      console.error(err);
    }
    setProcesando(false);
  };

  const golpesDisponibles = getGolpesDisponibles(xp, golem.golpes_utilizados);
  const hpMax = currentGolemData.hp;
  const vidaGolem = hpMax - golem.golpes_utilizados;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', color: '#fff', paddingBottom: '20px' }}>
      <header style={{ display: 'flex', alignItems: 'center', padding: '20px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => navigate('/perfil')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '5px' }}>
          <ChevronLeft size={24} />
        </button>
        <h1 style={{ flex: 1, margin: 0, textAlign: 'center', fontSize: '1.3rem', color: 'var(--accent-gold)' }}>CÁMARA DE LA FORJA</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,215,0,0.1)', padding: '5px 12px', borderRadius: '20px', color: 'var(--accent-gold)', fontWeight: 'bold' }}>
          🪙 {monedas}
        </div>
      </header>

      <main style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        
        {/* EL GÓLEM ACTUAL */}
        <section style={{ marginBottom: '30px', background: 'linear-gradient(145deg, #1a0f0f, #0a0a0a)', borderRadius: '16px', border: '1px solid #ff4757', padding: '20px', textAlign: 'center' }}>
          <h2 style={{ color: '#ff4757', margin: '0 0 5px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>{currentGolemData.nombre} (Nv. {golem.golem_nivel || 1})</h2>
          <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '15px' }}>{currentGolemData.desc}</p>
          
          <div style={{ marginBottom: '20px', minHeight: '160px' }}>
            <GolemAnimado 
              nivel={golem.golem_nivel || 1} 
              isHit={isHit} 
              isDead={golem.golem_vencido} 
              size={160} 
            />
          </div>

          {!golem.golem_vencido ? (
            <>
              <div style={{ background: '#222', height: '10px', borderRadius: '5px', overflow: 'hidden', marginBottom: '15px', border: '1px solid #444' }}>
                <div style={{ height: '100%', width: `${(vidaGolem / hpMax) * 100}%`, background: '#ff4757', transition: 'width 0.3s' }}></div>
              </div>
              <p style={{ margin: '0 0 15px 0', color: '#fff', fontWeight: 'bold' }}>Vida: {vidaGolem}/{hpMax}</p>
              
              <button 
                onClick={atacarGolem}
                disabled={procesando || golpesDisponibles <= 0}
                style={{ 
                  background: golpesDisponibles > 0 ? '#ff4757' : '#444', 
                  color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', 
                  fontWeight: 'bold', fontSize: '1rem', cursor: golpesDisponibles > 0 ? 'pointer' : 'not-allowed', width: '100%' 
                }}
              >
                {procesando ? 'Procesando...' : `ATACAR (Tienes ${golpesDisponibles} Golpes)`}
              </button>
              <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '10px' }}>Obtienes 1 Golpe cada 25 XP. (Acumulado: {xp} XP)</p>
            </>
          ) : (
            <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '1.2rem', padding: '15px', background: 'rgba(212,175,55,0.1)', borderRadius: '8px' }}>
              ¡GÓLEM VENCIDO!
              <div style={{ fontSize: '0.8rem', color: '#ccc', marginTop: '5px', fontWeight: 'normal', marginBottom: '15px' }}>Has ganado {currentGolemData.recompensa} Monedas.</div>
              
              {(golem.golem_nivel || 1) < 2 ? (
                <button 
                  onClick={avanzarGolem}
                  disabled={procesando}
                  style={{ 
                    background: 'var(--accent-gold)', color: '#000', border: 'none', padding: '12px 20px', borderRadius: '8px', 
                    fontWeight: 'bold', fontSize: '1rem', cursor: procesando ? 'not-allowed' : 'pointer', width: '100%',
                    opacity: procesando ? 0.7 : 1
                  }}
                >
                  {procesando ? 'Procesando...' : '🔥 Desafiar al Siguiente Gólem'}
                </button>
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#ccc', marginTop: '5px', fontWeight: 'normal' }}>Has derrotado a todos los Gólems disponibles.</div>
              )}
            </div>
          )}
        </section>

        {/* TOAST / SNACKBAR TEMÁTICO */}
        {toast.show && (
          <div style={{
            background: 'rgba(20, 20, 25, 0.95)',
            color: 'var(--accent-gold)',
            padding: '12px 24px',
            borderRadius: '12px',
            border: '1px solid var(--accent-gold)',
            boxShadow: '0 4px 15px rgba(212, 175, 55, 0.2)',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            textAlign: 'center',
            animation: 'toastFadeIn 0.3s ease-out',
            marginBottom: '20px'
          }}>
            {toast.message}
          </div>
        )}

        {/* CONFIRMAR COMPRA TEMÁTICO */}
        {confirmAction.show && (
          <div style={{
            background: 'linear-gradient(145deg, #1c1c1c, #2a2a2a)',
            color: '#fff',
            padding: '20px',
            borderRadius: '16px',
            border: '2px solid var(--accent-gold)',
            boxShadow: '0 8px 32px rgba(212, 175, 55, 0.3)',
            textAlign: 'center',
            animation: 'toastFadeIn 0.3s ease-out',
            marginBottom: '25px',
            position: 'relative'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: 'var(--accent-gold)' }}>¿Confirmar Adquisición?</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: '#ccc' }}>
              Se descontarán <strong>{confirmAction.precio} Monedas de Forja</strong> de tu saldo.
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button 
                onClick={cancelarCompra}
                style={{ background: 'transparent', border: '1px solid #666', color: '#aaa', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Cancelar
              </button>
              <button 
                onClick={ejecutarCompra}
                disabled={procesando}
                style={{ background: 'var(--accent-gold)', border: 'none', color: '#000', padding: '10px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {procesando ? 'Procesando...' : 'Aceptar'}
              </button>
            </div>
          </div>
        )}

        <h3 style={{ margin: '0 0 15px 0', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>Objetos de Gremio</h3>
        
        {/* Ficha de Reposo */}
        <div style={{ background: '#111', borderRadius: '12px', padding: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px', marginRight: '15px' }}>
            <Shield size={24} color="#78e08f" />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 3px 0', color: '#fff', fontSize: '1rem' }}>Ficha de Reposo</h4>
            <p style={{ margin: '0', color: '#aaa', fontSize: '0.8rem', lineHeight: '1.3' }}>Protege La Llama Viva por 1 día (Max 2).</p>
            <span style={{ fontSize: '0.75rem', color: '#78e08f' }}>En posesión: {inventario.ficha_reposo}/2</span>
          </div>
          <button 
            onClick={() => iniciarCompra('ficha_reposo', 100, false)}
            disabled={procesando || inventario.ficha_reposo >= 2}
            style={{ background: 'transparent', color: 'var(--accent-gold)', border: '1px solid var(--accent-gold)', padding: '8px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem', cursor: inventario.ficha_reposo >= 2 ? 'not-allowed' : 'pointer', opacity: inventario.ficha_reposo >= 2 ? 0.5 : 1 }}
          >
            100 🪙
          </button>
        </div>

        {/* Ánima del Bosque */}
        <div style={{ background: '#111', borderRadius: '12px', padding: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px', marginRight: '15px' }}>
            <Activity size={24} color="#8B5A2B" />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 3px 0', color: '#fff', fontSize: '1rem' }}>Ánima del Bosque</h4>
            <p style={{ margin: '0', color: '#aaa', fontSize: '0.8rem', lineHeight: '1.3' }}>Desbloquea la evolución del Árbol de Forja en tu Perfil (Permanente).</p>
          </div>
          {inventario.anima_bosque > 0 ? (
            <span style={{ color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 'bold' }}>ADQUIRIDO</span>
          ) : (
            <button 
              onClick={() => iniciarCompra('anima_bosque', 250, true)}
              disabled={procesando}
              style={{ background: 'transparent', color: 'var(--accent-gold)', border: '1px solid var(--accent-gold)', padding: '8px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              250 🪙
            </button>
          )}
        </div>

        {/* Borde de Fuego */}
        <div style={{ background: '#111', borderRadius: '12px', padding: '15px', marginBottom: '15px', display: 'flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px', marginRight: '15px' }}>
            <Flame size={24} color="#ff4757" />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 3px 0', color: '#fff', fontSize: '1rem' }}>Borde de Fuego</h4>
            <p style={{ margin: '0', color: '#aaa', fontSize: '0.8rem', lineHeight: '1.3' }}>Aura ardiente para tu foto de perfil (Permanente).</p>
          </div>
          {inventario.borde_fuego > 0 ? (
            <span style={{ color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 'bold' }}>ADQUIRIDO</span>
          ) : (
            <button 
              onClick={() => iniciarCompra('borde_fuego', 500, true)}
              disabled={procesando}
              style={{ background: 'transparent', color: 'var(--accent-gold)', border: '1px solid var(--accent-gold)', padding: '8px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              500 🪙
            </button>
          )}
        </div>

      </main>
      <style>{`
        @keyframes toastFadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
