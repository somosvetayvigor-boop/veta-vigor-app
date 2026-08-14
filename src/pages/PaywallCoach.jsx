import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, CheckCircle, Crown } from 'lucide-react';
import { Purchases } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../supabaseClient';

export default function PaywallCoach({ forced = false, onDismiss = null }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [proPackage, setProPackage] = useState(null);
  const [elitePackage, setElitePackage] = useState(null);
  const [currentPlan, setCurrentPlan] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const metaPlan = session.user.user_metadata?.suscripcion || session.user.user_metadata?.plan_membresia || '';
        if (metaPlan) setCurrentPlan(metaPlan);
        supabase.from('perfiles').select('plan_membresia').eq('id', session.user.id).single().then(({ data }) => {
          if (data?.plan_membresia) setCurrentPlan(data.plan_membresia);
        });
      }
    });

    const fetchOfferings = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const offerings = await Purchases.getOfferings();
          if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
            const pkgs = offerings.current.availablePackages;
            const pro = pkgs.find(p => p.product.identifier.toLowerCase().includes('pro'));
            const elite = pkgs.find(p => p.product.identifier.toLowerCase().includes('elite') || p.product.identifier.toLowerCase().includes('élite'));
            
            if (pro) setProPackage(pro);
            if (elite) setElitePackage(elite);
          }
        }
      } catch (e) {
        console.error("Error fetching coach offerings", e);
      }
    };
    
    fetchOfferings();
  }, []);

  const handlePurchase = async (pkgToBuy, planName) => {
    setLoading(true);
    try {
      if (Capacitor.getPlatform() === 'web') {
        const url = planName.includes('Pro') 
          ? "https://buy.stripe.com/eVq4gz3kxa4Xb094jGgjC05" 
          : "https://buy.stripe.com/fZufZh8ERa4X1pzcQcgjC04";
          
        if (window.confirm("Serás redirigido a Stripe para realizar tu pago de forma segura. ¿Continuar?")) {
           window.open(url, '_blank');
        }
        setLoading(false);
        return;
      }

      if (pkgToBuy) {
        await Purchases.purchasePackage({ aPackage: pkgToBuy });
        
        if (session?.user?.id) {
           // El servidor deduce el plan del product_id (mismo criterio por
           // patrón que se usa arriba para elegir el paquete). El cliente ya no
           // escribe plan_membresia.
           const { data, error: rpcError } = await supabase.rpc('activar_plan_por_compra', {
             p_product_id: pkgToBuy.product.identifier
           });

           if (rpcError || !data?.ok) {
             console.error('activar_plan_por_compra', rpcError || data);
             alert("Tu pago se procesó, pero no pudimos activar el plan. Escríbenos y lo resolvemos.");
             setLoading(false);
             return;
           }

           await supabase.auth.updateUser({ data: { suscripcion: data.plan, plan_membresia: data.plan } });
           alert(`¡Pago exitoso! Ahora eres ${data.plan}`);
           window.location.reload();
        } else {
           navigate('/panel-entrenador');
        }
      } else {
        const landingPageUrl = "https://vetayvigor.com/#entrenadores"; 
        if (window.confirm("Serás redirigido a nuestra página web para realizar tu pago de forma segura. ¿Continuar?")) {
           window.open(landingPageUrl, '_blank');
        }
        setLoading(false);
      }
    } catch (e) {
      if (!e.userCancelled) {
        alert("Ocurrió un error con la compra: " + e.message);
      }
      setLoading(false);
    }
  };

  const isPro = currentPlan.includes('Entrenador Pro');
  const isElite = currentPlan.includes('Entrenador Élite') || currentPlan.includes('Entrenador Elite');
  const isForced = forced || new URLSearchParams(window.location.search).get('forced') === 'true';

  const handleNotNow = async () => {
    if (session?.user?.id) {
      await supabase.rpc('descartar_paywall');
    }
    if (onDismiss) {
      onDismiss();
    } else {
      navigate('/panel-entrenador');
    }
  };

  return (
    <div className="container" style={{ paddingBottom: '90px', paddingTop: '20px', minHeight: '100vh', height: '100vh', overflowY: 'auto' }}>
      {!isForced && (
        <button 
          onClick={() => navigate('/panel-entrenador')} 
          style={{ background: 'none', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', cursor: 'pointer' }}
        >
          <ArrowLeft size={20} /> Volver a mi panel
        </button>
      )}

      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 className="gold-gradient-text" style={{ fontSize: '2.5rem', margin: '0 0 10px 0' }}>Lleva tu negocio al siguiente nivel</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: '1.5' }}>
          El plan <strong>Freemium</strong> te permite gestionar hasta 2 atletas gratis. Para hacer crecer tu cartera de clientes y profesionalizar tus servicios, elige un plan Pro o Élite.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Pro Plan */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '25px', border: isPro ? '2px solid #4ade80' : '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
          {isPro && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: '#4ade80', color: 'black', textAlign: 'center', padding: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              TU PLAN ACTUAL
            </div>
          )}
          <h2 style={{ fontSize: '1.5rem', margin: '15px 0 10px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users color="var(--accent-gold)" /> Entrenador Pro
          </h2>
          <h3 style={{ fontSize: '2rem', margin: '0 0 20px 0', color: isPro ? '#4ade80' : 'var(--text-color)' }}>
            {proPackage ? proPackage.product.priceString : '$599'} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>{proPackage ? (proPackage.packageType === 'MONTHLY' ? '/ mes' : '') : 'MXN / mes'}</span>
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#4cd137" /> Hasta 20 atletas activos simultáneos</li>
            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#4cd137" /> Analíticas de ganancias y retención</li>
            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#4cd137" /> Expedientes clínicos y notas privadas</li>
            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#4cd137" /> Agenda de citas con notificaciones</li>
            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="var(--accent-gold)" /> <strong style={{color: 'var(--accent-gold)'}}>INCLUYE ACCESO VIP DE ATLETA</strong></li>
          </ul>
          <button 
            className="btn-primary" 
            style={{ width: '100%', padding: '15px', background: isPro ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255,255,255,0.1)', color: isPro ? '#4ade80' : 'white', border: isPro ? '1px solid #4ade80' : '1px solid rgba(255,255,255,0.2)' }} 
            disabled={loading || isPro}
            onClick={() => handlePurchase(proPackage, 'Entrenador Pro')}
          >
            {isPro ? '✓ Plan Contratado' : (loading ? 'Procesando...' : 'Mejorar a Pro')}
          </button>
        </div>

        {/* Elite Plan */}
        <div style={{ background: 'linear-gradient(145deg, rgba(212,175,55,0.15) 0%, rgba(0,0,0,0) 100%)', borderRadius: '16px', padding: '25px', border: isElite ? '2px solid #4ade80' : '2px solid var(--accent-gold)', position: 'relative' }}>
          {isElite ? (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: '#4ade80', color: 'black', textAlign: 'center', padding: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              TU PLAN ACTUAL
            </div>
          ) : (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'var(--accent-gold)', color: 'black', padding: '4px', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center' }}>
              MEJOR VALOR
            </div>
          )}
          <h2 style={{ fontSize: '1.5rem', margin: '15px 0 10px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Crown color="var(--accent-gold)" /> Entrenador Élite
          </h2>
          <h3 style={{ fontSize: '2rem', margin: '0 0 20px 0', color: isElite ? '#4ade80' : 'var(--text-color)' }}>
            {elitePackage ? elitePackage.product.priceString : '$1,499'} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>{elitePackage ? (elitePackage.packageType === 'MONTHLY' ? '/ mes' : '') : 'MXN / mes'}</span>
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#4cd137" /> <strong>Hasta 100 atletas activos</strong></li>
            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#4cd137" /> Todo lo incluido en Pro</li>
            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#4cd137" /> Selección Múltiple y Asignación Masiva</li>
            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="#4cd137" /> Sube tu Logo y Marca Personal</li>
            <li style={{ display: 'flex', gap: '10px', alignItems: 'center' }}><CheckCircle size={18} color="var(--accent-gold)" /> <strong style={{color: 'var(--accent-gold)'}}>INCLUYE ACCESO VIP DE ATLETA</strong></li>
          </ul>
          <button 
            style={{ width: '100%', padding: '15px', background: isElite ? 'rgba(74, 222, 128, 0.15)' : 'var(--accent-gold)', color: isElite ? '#4ade80' : 'black', fontWeight: 'bold', border: isElite ? '1px solid #4ade80' : 'none', borderRadius: '8px' }} 
            disabled={loading || isElite}
            onClick={() => handlePurchase(elitePackage, 'Entrenador Élite')}
          >
            {isElite ? '✓ Plan Contratado' : (loading ? 'Procesando...' : 'Mejorar a Élite')}
          </button>
        </div>
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '30px', padding: '0 20px' }}>
        <p style={{ fontSize: '0.8rem', color: '#666', lineHeight: '1.5', marginBottom: '20px' }}>
          El pago se cargará de forma segura a través de tu cuenta. Las suscripciones se renuevan automáticamente al final del periodo a menos que se cancelen con 24 horas de antelación. Al comprar un plan de Entrenador, tus suscripciones previas en este mismo grupo serán canceladas.
        </p>

        {isForced && (
          <button 
            onClick={handleNotNow}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#888', 
              textDecoration: 'underline', 
              fontSize: '0.9rem', 
              cursor: 'pointer',
              padding: '10px'
            }}
          >
            Quizás en otro momento, continuar con mi plan gratuito
          </button>
        )}
      </div>
    </div>
  );
}
