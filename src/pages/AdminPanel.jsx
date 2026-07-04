import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Edit, Trash2, Users, Database, Dumbbell, CalendarDays, ShieldAlert, AlertTriangle } from 'lucide-react';
import AdminGestorSistemas from '../components/AdminGestorSistemas';
import AdminAtletas from '../components/AdminAtletas';
import AdminReportes from '../components/AdminReportes';
import AdminArticulos from '../components/AdminArticulos';
import AdminBiblioteca from '../components/AdminBiblioteca';
import { Newspaper } from 'lucide-react';

export default function AdminPanel({ session }) {
  const navigate = useNavigate();
  const isAdmin = session?.user?.email === 'somos.vetayvigor@gmail.com';
  const [activeTab, setActiveTab] = useState('atletas'); // atletas, sistemas, reportes, biblioteca

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
          onClick={() => setActiveTab('atletas')} 
          style={{ 
            background: activeTab === 'atletas' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)', 
            color: activeTab === 'atletas' ? 'black' : 'white',
            padding: '10px 15px', borderRadius: '8px', border: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
          }}>
          <Users size={18} /> Atletas Registrados
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
      {activeTab === 'atletas' && <AdminAtletas session={session} />}

      {activeTab === 'sistemas' && <AdminGestorSistemas />}

      {activeTab === 'reportes' && <AdminReportes />}

      {activeTab === 'biblioteca' && <AdminBiblioteca />}

      {activeTab === 'articulos' && <AdminArticulos session={session} />}

    </div>
  );
}
