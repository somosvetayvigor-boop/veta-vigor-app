import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, ArrowLeft, Crown, Shield, Activity, Users, Star, Award, Zap } from 'lucide-react';
import { Purchases } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../supabaseClient';

export default function Paywall() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState([]);
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const fetchOfferings = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const offerings = await Purchases.getOfferings();
          if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
            console.log("Offerings loaded:", offerings.current.availablePackages);
            setPackages(offerings.current.availablePackages);
          }
        }
      } catch (e) {
        console.error("Error fetching offerings", e);
      }
    };
    
    fetchOfferings();
  }, []);

  const visualDataMap = {
    'argentum_mensual:base-mensual': {
      icon: <Shield size={24} style={{ color: '#C0C0C0' }} />,
      color: '#C0C0C0',
      popular: false,
      features: [
        'Membresía Mensual con **Acceso Total**.',
        'Acceso completo a la **Comunidad VIP**.',
        'Sistemas Vigor Corporal y Carga de Hierro.'
      ],
      missing: [
        'Sin acceso a Línea Roja ni Laboratorio Nutricional.'
      ]
    },
    'aurum_semestral:base-semestral': {
      icon: <Star size={24} style={{ color: '#FFD700' }} />,
      color: '#FFD700',
      popular: false,
      features: [
        'Membresía Semestral con **Acceso Total**.',
        'Acceso completo a la **Comunidad VIP** e interactiva.',
        'Progresiones ilimitadas de Rutas de Maestría.'
      ],
      missing: [
        'Sin acceso a Línea Roja ni Laboratorio Nutricional.'
      ]
    },
    'platinum_anual:base-anual': {
      icon: <Award size={24} style={{ color: '#E5E4E2' }} />,
      color: '#E5E4E2',
      popular: false,
      features: [
        'Acceso completo a todos los sistemas.',
        'Laboratorio Nutricional Pro: Calculadoras avanzadas.',
        'Línea Roja VIP: Soporte directo 1 a 1 por WhatsApp.',
        'Entrenamientos híbridos, calistenia y pesas ilimitados.'
      ],
      missing: []
    },
    'vitalicio_unico': {
      icon: <Crown size={24} style={{ color: 'var(--accent-gold)' }} />,
      color: 'var(--accent-gold)',
      popular: true,
      features: [
        'Acceso Vitalicio de por vida. Sin pagos recurrentes.',
        'Acceso completo a todos los sistemas.',
        'Laboratorio Nutricional Pro: Calculadoras avanzadas.',
        'Línea Roja VIP: Soporte directo 1 a 1 por WhatsApp.',
        'Gana ingresos pasivos por referido.'
      ],
      missing: []
    }
  };

  const hardcodedPlans = [
    {
      id: 'mensual_argentum',
      name: 'Socio Argentum',
      price: '$189',
      period: 'MXN/mes',
      subtitle: 'Suscripción Mensual',
      ...visualDataMap['argentum_mensual:base-mensual']
    },
    {
      id: 'semestral_aurum',
      name: 'Socio Aurum',
      price: '$799',
      period: 'MXN/semestre',
      subtitle: 'Suscripción Semestral',
      ...visualDataMap['aurum_semestral:base-semestral']
    },
    {
      id: 'anual_platinum',
      name: 'Socio Platinum',
      price: '$1,299',
      period: 'MXN/año',
      subtitle: 'Suscripción Anual Recurrente',
      ...visualDataMap['platinum_anual:base-anual']
    },
    {
      id: 'vitalicio_fundador',
      name: 'Socio Fundador Vitalicio',
      price: '$1,299',
      period: 'MXN',
      subtitle: 'PAGO ÚNICO Y VITALICIO',
      ...visualDataMap['vitalicio_unico']
    }
  ];

  const displayPlans = packages.length > 0 
    ? packages.map(pkg => {
        const productId = pkg.product.identifier;
        const visual = visualDataMap[productId] || { 
          icon: <Shield size={24} style={{color: '#fff'}}/>, 
          color: '#fff', popular: false, features: [], missing: [] 
        };
        
        return {
          id: pkg.identifier,
          pkgData: pkg,
          name: pkg.product.title.replace(/\(.*?\)/g, '').trim() || visual.name,
          price: pkg.product.priceString,
          period: pkg.packageType === 'MONTHLY' ? 'MXN/mes' : 
                  pkg.packageType === 'SIX_MONTH' ? 'MXN/semestre' : 
                  pkg.packageType === 'ANNUAL' ? 'MXN/año' : 'MXN',
          subtitle: pkg.product.description,
          icon: visual.icon,
          color: visual.color,
          popular: visual.popular,
          features: visual.features,
          missing: visual.missing
        }
      })
    : hardcodedPlans;

  // Ordenar para que Vitalicio siempre quede al final si queremos (opcional),
  // pero ya vienen en el orden del array de RevenueCat, lo cual es ideal.

  const handlePurchase = async (plan) => {
    setLoading(true);
    try {
      if (plan.pkgData) {
        // Compra real vía RevenueCat (Google Play / App Store)
        const { customerInfo } = await Purchases.purchasePackage({ aPackage: plan.pkgData });
        
        let newPlanName = null;
        const productId = plan.pkgData.product.identifier;
        
        if (productId === 'vitalicio_unico') newPlanName = 'Socio Fundador Vitalicio';
        else if (productId === 'platinum_anual:base-anual') newPlanName = 'Plan Platinum';
        else if (productId === 'aurum_semestral:base-semestral') newPlanName = 'Socio Aurum';
        else if (productId === 'argentum_mensual:base-mensual') newPlanName = 'Socio Argentum';

        if (newPlanName && session?.user?.id) {
           await supabase.from('perfiles').update({ plan_membresia: newPlanName }).eq('id', session.user.id);
           await supabase.auth.updateUser({ data: { suscripcion: newPlanName } });
           alert(`¡Pago exitoso! Bienvenido a Veta & Vigor ${newPlanName}`);
           window.location.reload();
        } else {
           navigate(-1);
        }
      } else {
        // Compra en PWA (Web) -> Redirigir a Landing Page de Stripe
        // Aquí puedes cambiar el URL a tu dominio real de la landing page
        const landingPageUrl = "https://vetayvigor.com/#membresias"; // <-- REEMPLAZAR CON TU URL REAL
        
        if (window.confirm("Serás redirigido a nuestra página oficial para realizar tu pago de forma segura. ¿Continuar?")) {
           window.open(landingPageUrl, '_blank');
        }
        setLoading(false);
      }
    } catch (e) {
      if (!e.userCancelled) {
        alert("Ocurrió un error con la compra: " + e.message);
      }
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-dark)',
      color: 'var(--text-light)',
      paddingBottom: '40px',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Header Estilo Spotify */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(197, 160, 89, 0.3) 0%, var(--bg-dark) 100%)',
        padding: '40px 20px',
        textAlign: 'center'
      }}>
        <button 
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            background: 'rgba(0,0,0,0.5)',
            border: 'none',
            color: 'white',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          <ArrowLeft size={24} />
        </button>
        
        <Crown size={48} color="var(--accent-gold)" style={{ margin: '0 auto 15px' }} />
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0 0 10px 0' }}>
          Lleva tu entrenamiento al <span style={{ color: 'var(--accent-gold)' }}>Siguiente Nivel</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#ccc', maxWidth: '400px', margin: '0 auto' }}>
          Desbloquea rutinas personalizadas, laboratorio nutricional y soporte VIP.
        </p>
      </div>

      {/* Planes de Precios */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '0 20px',
        maxWidth: '500px',
        margin: '0 auto'
      }}>
        {displayPlans.map((plan) => (
          <div key={plan.id} style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            padding: '25px',
            border: plan.popular ? '2px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.1)',
            position: 'relative',
            boxShadow: plan.popular ? '0 0 20px rgba(197, 160, 89, 0.2)' : 'none',
            overflow: 'hidden'
          }}>
            {plan.popular && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                background: 'var(--accent-gold)',
                color: 'black',
                textAlign: 'center',
                padding: '4px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}>
                Cupos Limitados 💎
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: plan.popular ? '15px' : '0', marginBottom: '15px' }}>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${plan.color}`
              }}>
                {plan.icon}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>{plan.name}</h3>
                <span style={{ fontSize: '0.8rem', color: '#aaa' }}>{plan.subtitle}</span>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{plan.price}</span>
              <span style={{ fontSize: '1rem', color: '#aaa', marginLeft: '5px' }}>{plan.period}</span>
            </div>

            <button
              onClick={() => handlePurchase(plan)}
              disabled={loading}
              className="btn-primary"
              style={{
                width: '100%',
                background: plan.popular ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)',
                color: plan.popular ? 'black' : 'white',
                border: plan.popular ? 'none' : '1px solid rgba(255,255,255,0.2)',
                marginBottom: '25px'
              }}
            >
              {loading ? 'Procesando...' : (plan.popular ? 'Adquirir Vitalicio' : 'Suscribirse')}
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {plan.features.map((feature, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <CheckCircle2 size={18} style={{ color: plan.popular ? 'var(--accent-gold)' : '#4ade80', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '0.9rem', color: '#ccc', lineHeight: '1.4' }} dangerouslySetInnerHTML={{ __html: feature.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
                </div>
              ))}
              {plan.missing.map((missing, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', opacity: 0.5 }}>
                  <XCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontSize: '0.9rem', color: '#999', lineHeight: '1.4' }}>{missing}</span>
                </div>
              ))}
            </div>

          </div>
        ))}
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '30px', padding: '0 20px' }}>
        <p style={{ fontSize: '0.8rem', color: '#666', lineHeight: '1.5' }}>
          El pago se cargará de forma segura a través de tu cuenta de Google Play. Las suscripciones se renuevan automáticamente al final del periodo a menos que se cancelen con 24 horas de antelación.
        </p>
      </div>
    </div>
  );
}
