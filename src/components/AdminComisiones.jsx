import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Gem, Users, CircleDollarSign, Check, RotateCcw } from 'lucide-react';

// Calcula el % de comisión igual que MisGanancias.jsx -- mismos escalones
// (10% / 15% / 20%), o el override de comision_personalizada si lo tiene.
function calcularNivel(referidosCount, comisionPersonalizada) {
  if (comisionPersonalizada && comisionPersonalizada > 0) {
    return { tier: 'Influencer VIP', porcentaje: comisionPersonalizada };
  }
  const count = referidosCount || 0;
  if (count < 6) return { tier: 'Base', porcentaje: 10 };
  if (count < 16) return { tier: 'Pro', porcentaje: 15 };
  return { tier: 'Élite', porcentaje: 20 };
}

// Precios vigentes (confirmados con Gerardo el 17/08), MXN. Si cambian los
// precios reales en Paywall.jsx/PaywallCoach.jsx, actualizar acá también --
// esto es solo para calcular la comisión SUGERIDA, no la fuente de verdad
// del precio real (esa es RevenueCat/Play Console).
const PRECIOS_PLANES = {
  'Socio Argentum': 189,
  'Socio Aurum': 799,
  'Plan Platinum': 1299,
  'Socio Fundador Vitalicio': 1299,
  'Entrenador Pro': 599,
  'Entrenador Élite': 1499,
};

function calcularComisionSugerida(plan, porcentaje) {
  const precio = PRECIOS_PLANES[plan];
  if (!precio) return null;
  return (precio * porcentaje) / 100;
}

export default function AdminComisiones() {
  const [fundadores, setFundadores] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReporte = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_reporte_comisiones_fundadores');
    if (!error && data) {
      setFundadores(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReporte();
  }, []);

  const marcarPagado = async (referidoId, montoSugerido) => {
    const montoStr = window.prompt(
      '¿Cuánto le pagaste al fundador por este referido este mes (MXN)?',
      montoSugerido != null ? montoSugerido.toFixed(2) : ''
    );
    if (montoStr === null) return; // canceló el prompt

    const monto = parseFloat(montoStr);
    if (isNaN(monto) || monto < 0) {
      alert('Monto inválido.');
      return;
    }

    const { data, error } = await supabase.rpc('admin_marcar_comision_pagada', {
      p_referido_id: referidoId,
      p_monto: monto,
    });

    if (error || !data?.success) {
      alert('No se pudo marcar como pagado: ' + (error?.message || data?.error || 'error desconocido'));
      return;
    }
    fetchReporte();
  };

  const desmarcarPagado = async (referidoId) => {
    if (!window.confirm('¿Quitar la marca de "pagado" de este referido para este mes?')) return;

    const { data, error } = await supabase.rpc('admin_desmarcar_comision_pagada', {
      p_referido_id: referidoId,
    });

    if (error || !data?.success) {
      alert('No se pudo desmarcar: ' + (error?.message || data?.error || 'error desconocido'));
      return;
    }
    fetchReporte();
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--accent-gold)' }}><i className="fa-solid fa-spinner fa-spin fa-2x"></i></div>;
  }

  if (fundadores.length === 0) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <Gem size={50} color="var(--accent-gold)" style={{ margin: '0 auto 15px auto', opacity: 0.5 }} />
        <h3 style={{ color: '#fff' }}>Sin Socios Fundadores Vitalicios todavía</h3>
        <p style={{ color: 'var(--text-muted)' }}>Cuando alguien compre ese plan, va a aparecer acá con su código y sus referidos.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <div style={{ padding: '15px', background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '12px' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#ccc' }}>
          La "comisión sugerida" es precio del plan × % del fundador — un cálculo, no una confirmación de pago.
          Antes de marcar "pagado", confirmá en RevenueCat/Play Console que ese referido pagó de verdad este mes
          (el plan que ves acá es su plan ACTUAL, no prueba que pagó este ciclo específico).
        </p>
      </div>

      {fundadores.map((f) => {
        const { tier, porcentaje } = calcularNivel(f.referidos_count, f.comision_personalizada);
        return (
          <div key={f.id} className="card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-gold)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
              <div>
                <h4 style={{ margin: '0 0 2px 0', color: '#fff' }}>{f.nombre || '(sin nombre)'}</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{f.email}</span>
                <div style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', marginTop: '4px', fontFamily: 'monospace' }}>{f.codigo_referido || '(sin código todavía)'}</div>
              </div>
              <span style={{ background: 'rgba(212, 175, 55, 0.2)', color: 'var(--accent-gold)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                {tier} · {porcentaje}%
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: '0.85rem', marginBottom: '10px' }}>
              <Users size={16} /> {f.referidos_count || 0} referido(s)
            </div>

            {(f.referidos || []).length === 0 ? (
              <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>Todavía nadie usó su código.</p>
            ) : (
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px' }}>
                {f.referidos.map((r, i) => {
                  const sugerido = calcularComisionSugerida(r.plan_membresia, porcentaje);
                  return (
                    <div key={r.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 5px', borderBottom: i < f.referidos.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', gap: '10px' }}>
                      <div>
                        <div style={{ color: '#fff', fontSize: '0.9rem' }}>{r.nombre || '(sin nombre)'}</div>
                        <div style={{ color: '#888', fontSize: '0.75rem' }}>{r.email}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '3px' }}>
                          <CircleDollarSign size={14} /> {r.plan_membresia || 'Atleta Base (Gratis)'}
                          {sugerido != null && <span style={{ color: 'var(--accent-gold)' }}>· sugerido ${sugerido.toFixed(2)} MXN</span>}
                        </div>
                      </div>

                      {r.pagado_este_mes ? (
                        <button
                          onClick={() => desmarcarPagado(r.id)}
                          title="Quitar marca de pagado"
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(76, 209, 55, 0.15)', border: '1px solid rgba(76, 209, 55, 0.4)', color: '#4cd137', borderRadius: '8px', padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          <Check size={14} /> ${Number(r.monto_pagado || 0).toFixed(2)} <RotateCcw size={12} />
                        </button>
                      ) : (
                        <button
                          onClick={() => marcarPagado(r.id, sugerido)}
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: '8px', padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          Marcar pagado
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
