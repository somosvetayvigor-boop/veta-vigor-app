import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Edit, Trash2, Users, Database, Dumbbell, CalendarDays, ShieldAlert, AlertTriangle } from 'lucide-react';
import AdminGestorSistemas from '../components/AdminGestorSistemas';
import AdminAtletas from '../components/AdminAtletas';
import AdminReportes from '../components/AdminReportes';
import AdminArticulos from '../components/AdminArticulos';
import AdminBiblioteca from '../components/AdminBiblioteca';
import AdminEntrenadores from '../components/AdminEntrenadores';
import AdminRetos from '../components/AdminRetos';
import { Newspaper, Flame, Send } from 'lucide-react';

export default function AdminPanel({ session }) {
  const navigate = useNavigate();
  const isAdmin = session?.user?.email === 'somos.vetayvigor@gmail.com';
  const [activeTab, setActiveTab] = useState('retos'); // entrenadores, atletas, sistemas, reportes, biblioteca, articulos, retos

  if (!isAdmin) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <ShieldAlert size={60} color="var(--error-color)" style={{ margin: '0 auto 20px auto' }} />
        <h1 className="gold-gradient-text">Acceso Denegado</h1>
        <p style={{ color: 'var(--text-muted)' }}>No tienes permisos de Dios para ver esta página.</p>
        <button className="btn-secondary" onClick={() => navigate(-1)} style={{ marginTop: '20px' }}>Volver al mundo mortal</button>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBottom: '90px' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px' }}>
        <ChevronLeft size={20} /> Volver al Perfil
      </button>

      <h1 className="gold-gradient-text" style={{ fontSize: '2rem', marginBottom: '5px' }}>Panel de Creador</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Modo Dios Activado. Ten cuidado con lo que modificas.</p>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => setActiveTab('retos')} 
          style={{ 
            background: activeTab === 'retos' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)', 
            color: activeTab === 'retos' ? 'black' : 'white',
            padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
          }}>
          <Flame size={18} /> Retos 21 Días
        </button>
        <button 
          onClick={() => setActiveTab('motor')} 
          style={{ 
            background: activeTab === 'motor' ? '#e55039' : 'rgba(255,255,255,0.1)', 
            color: activeTab === 'motor' ? 'white' : 'white',
            padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
          }}>
          <Send size={18} /> Motor Push
        </button>
        <button 
          onClick={() => setActiveTab('entrenadores')} 
          style={{ 
            background: activeTab === 'entrenadores' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)', 
            color: activeTab === 'entrenadores' ? 'black' : 'white',
            padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
          }}>
          <Users size={18} /> Entrenadores
        </button>
        <button 
          onClick={() => setActiveTab('atletas')} 
          style={{ 
            background: activeTab === 'atletas' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)', 
            color: activeTab === 'atletas' ? 'black' : 'white',
            padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
          }}>
          <Users size={18} /> Atletas Normales
        </button>
        <button 
          onClick={() => setActiveTab('sistemas')} 
          style={{ 
            background: activeTab === 'sistemas' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)', 
            color: activeTab === 'sistemas' ? 'black' : 'white',
            padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
          }}>
          <CalendarDays size={18} /> Gestor de Sistemas
        </button>
        <button 
          onClick={() => setActiveTab('reportes')} 
          style={{ 
            background: activeTab === 'reportes' ? '#e55039' : 'rgba(255,255,255,0.1)', 
            color: activeTab === 'reportes' ? 'white' : 'white',
            padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
          }}>
          <AlertTriangle size={18} /> Reportes
        </button>
        <button 
          onClick={() => setActiveTab('biblioteca')} 
          style={{ 
            background: activeTab === 'biblioteca' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)', 
            color: activeTab === 'biblioteca' ? 'black' : 'white',
            padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
          }}>
          <Database size={18} /> Base de Datos
        </button>
        <button 
          onClick={() => setActiveTab('articulos')} 
          style={{ 
            background: activeTab === 'articulos' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)', 
            color: activeTab === 'articulos' ? 'black' : 'white',
            padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
          }}>
          <Newspaper size={18} /> Artículos
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'motor' && (
        <div style={{ background: '#1a1a1e', border: '1px solid #e55039', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ color: 'white', marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Send color="#e55039" /> Central del Motor Push
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>
            El motor de notificaciones del Reto 21 Días funciona automáticamente cada hora evaluando las fechas y misiones pendientes.
            Sin embargo, puedes forzar una ejecución manual aquí como contingencia. La seguridad de idempotencia evitará que se envíen mensajes duplicados.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '20px' }}>
            <button 
              onClick={async () => {
                if (window.confirm("¿Estás seguro de ejecutar el motor push ahora? Se evaluarán todas las reglas de fecha y hora actual.")) {
                  try {
                    const res = await fetch('/api/cron_reto21', { method: 'POST', headers: { 'Authorization': 'Bearer secret-vigor-21' } });
                    const data = await res.json();
                    alert("Motor ejecutado. Revisa la consola (F12) para ver los logs detallados.");
                    console.log("Logs del Motor Push:", data.logs);
                  } catch (e) {
                    alert("Error ejecutando motor: " + e.message);
                  }
                }
              }}
              style={{ background: '#e55039', color: 'white', border: 'none', padding: '15px 25px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}
            >
              Ejecutar Motor Manualmente
            </button>
          </div>
        </div>
      )}

      {activeTab === 'retos' && <AdminRetos />}

      {activeTab === 'entrenadores' && <AdminEntrenadores />}

      {activeTab === 'atletas' && <AdminAtletas session={session} />}

      {activeTab === 'sistemas' && <AdminGestorSistemas />}

      {activeTab === 'reportes' && <AdminReportes />}

      {activeTab === 'biblioteca' && <AdminBiblioteca />}

      {activeTab === 'articulos' && <AdminArticulos session={session} />}

    </div>
  );
}
