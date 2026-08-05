import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronLeft, Key, FileText, Gift, Loader, Shield, Flame, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getGolpesTotales, getGolpesDisponibles } from '../utils/ProgressionEngine';

export default function LaPrueba({ session }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [isHit, setIsHit] = useState(false);
  const [monedas, setMonedas] = useState(0);
  const [xp, setXp] = useState(0);
  const [inventario, setInventario] = useState({ ficha_reposo: 0, anima_bosque: 0, borde_fuego: 0 });
  const [golem, setGolem] = useState({ golpes_utilizados: 0, golem_vencido: false });

  const loadDatos = async () => {
    if (!session?.user) return;
    try {
      // Perfil (XP y Monedas)
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('puntos_forja, xp')
        .eq('id', session.user.id)
        .single();
        
      if (perfil) {
        setMonedas(perfil.monedas_forja ?? perfil.puntos_forja ?? 0); // Fallback a puntos_forja antiguo
        setXp(perfil.xp || 0);
      }

      // Inventario
      const { data: inv } = await supabase
        .from('rpg_inventario')
        .select('item_id, cantidad')
        .eq('user_id', session.user.id);
        
      if (inv) {
        const invObj = { ficha_reposo: 0, anima_bosque: 0, borde_fuego: 0 };
        inv.forEach(i => invObj[i.item_id.replace(/ /g, '_')] = i.cantidad);
        setInventario(invObj);
      }

      // Golem
      const { data: g } = await supabase
        .from('golem_progreso')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
        
      if (g) {
        setGolem({ golpes_utilizados: g.golpes_utilizados, golem_vencido: g.golem_vencido });
      }

    } catch (err) {
      console.error("Error cargando La Prueba:", err);
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
      alert("No tienes Golpes de Vigor disponibles. Acumula 25 XP para obtener uno.");
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
        alert(data.error);
      } else {
        if (data.golem_muerto) {
          alert(`¡HAS VENCIDO AL GÓLEM DEL LASTRE! Has ganado ${data.recompensa} Monedas.`);
        } else {
          alert(`¡Golpe asestado! Al Gólem le queda ${data.golpes_restantes_vida} de vida.`);
        }
        await loadDatos();
      }
    } catch (err) {
      alert("Error al atacar al Gólem.");
      console.error(err);
    } finally {
      setProcesando(false);
    }
  };

  const comprarItem = async (itemId, precio, esPermanente) => {
    if (monedas < precio) {
      alert("No tienes suficientes Monedas de Forja.");
      return;
    }

    if (itemId === 'ficha_reposo' && inventario.ficha_reposo >= 2) {
      alert("Ya tienes el máximo de 2 Fichas de Reposo.");
      return;
    }

    if (esPermanente && inventario[itemId] > 0) {
      alert("Ya posees este ítem permanentemente.");
      return;
    }

    if (window.confirm(`¿Seguro que deseas adquirir esto por ${precio} Monedas?`)) {
      setProcesando(true);
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
          alert(data.error);
        } else {
          alert("¡Adquisición exitosa!");
          await loadDatos();
        }
      } catch (err) {
        alert("Error en la transacción.");
        console.error(err);
      } finally {
        setProcesando(false);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-dark)', color: 'var(--accent-gold)' }}>
        <Loader className="spin" size={32} />
      </div>
    );
  }

  const golpesDisponibles = getGolpesDisponibles(xp, golem.golpes_utilizados);
  const vidaGolem = 10 - golem.golpes_utilizados;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', color: '#fff', paddingBottom: '20px' }}>
      <style>{`
        @keyframes golemShake {
          0% { transform: translate(2px, 1px) rotate(0deg); filter: drop-shadow(0 0 25px #ff0000) brightness(1.5); }
          20% { transform: translate(-3px, -2px) rotate(-1deg); filter: drop-shadow(0 0 35px #ff0000) brightness(1.2); }
          40% { transform: translate(3px, 2px) rotate(1deg); filter: drop-shadow(0 0 15px #ff4757) brightness(1); }
          60% { transform: translate(-2px, -1px) rotate(0deg); }
          80% { transform: translate(2px, 1px) rotate(-1deg); }
          100% { transform: translate(0px, 0px) rotate(0deg); filter: drop-shadow(0 0 15px #ff4757); }
        }
        @keyframes golemHeartbeat {
          0% { transform: scale(1); filter: drop-shadow(0 0 15px #ff4757); }
          15% { transform: scale(1.05); filter: drop-shadow(0 0 25px #ff4757) brightness(1.2); }
          30% { transform: scale(1); filter: drop-shadow(0 0 15px #ff4757); }
          45% { transform: scale(1.05); filter: drop-shadow(0 0 25px #ff4757) brightness(1.2); }
          60% { transform: scale(1); filter: drop-shadow(0 0 15px #ff4757); }
          100% { transform: scale(1); filter: drop-shadow(0 0 15px #ff4757); }
        }
      `}</style>
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
        
        {/* EL GÓLEM DEL LASTRE */}
        <section style={{ marginBottom: '30px', background: 'linear-gradient(145deg, #1a0f0f, #0a0a0a)', borderRadius: '16px', border: '1px solid #ff4757', padding: '20px', textAlign: 'center' }}>
          <h2 style={{ color: '#ff4757', margin: '0 0 5px 0', textTransform: 'uppercase', letterSpacing: '1px' }}>El Gólem del Lastre</h2>
          <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '15px' }}>Representa la inercia, excusas y abandono.</p>
          
          <div 
            style={{ 
              fontSize: '4rem', 
              marginBottom: '10px', 
              filter: golem.golem_vencido ? 'grayscale(100%) opacity(0.3)' : (isHit ? 'drop-shadow(0 0 25px #ff0000)' : 'drop-shadow(0 0 15px #ff4757)'),
              animation: isHit && !golem.golem_vencido ? 'golemShake 0.3s ease-in-out' : (!golem.golem_vencido ? 'golemHeartbeat 2.5s infinite ease-in-out' : 'none'),
              transition: 'filter 0.1s ease-out',
              display: 'inline-block'
            }}
          >
            🗿
          </div>

          {!golem.golem_vencido ? (
            <>
              <div style={{ background: '#222', height: '10px', borderRadius: '5px', overflow: 'hidden', marginBottom: '15px', border: '1px solid #444' }}>
                <div style={{ height: '100%', width: `${(vidaGolem / 10) * 100}%`, background: '#ff4757', transition: 'width 0.3s' }}></div>
              </div>
              <p style={{ margin: '0 0 15px 0', color: '#fff', fontWeight: 'bold' }}>Vida: {vidaGolem}/10</p>
              
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
              <div style={{ fontSize: '0.8rem', color: '#ccc', marginTop: '5px', fontWeight: 'normal' }}>Has ganado 100 Monedas y la insignia "Rompí el Lastre". Próximo adversario pronto.</div>
            </div>
          )}
        </section>

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
            onClick={() => comprarItem('ficha_reposo', 100, false)}
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
              onClick={() => comprarItem('anima_bosque', 250, true)}
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
              onClick={() => comprarItem('borde_fuego', 500, true)}
              disabled={procesando}
              style={{ background: 'transparent', color: 'var(--accent-gold)', border: '1px solid var(--accent-gold)', padding: '8px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              500 🪙
            </button>
          )}
        </div>

      </main>
    </div>
  );
}
