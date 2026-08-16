import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Trophy, CheckCircle, Clock, Search, Medal, Eye, ChevronLeft, Activity } from 'lucide-react';
import GaleriaReto from './GaleriaReto';

export default function AdminRetos() {
  const [participantes, setParticipantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingUserId, setViewingUserId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('perfiles')
      .select(`
        id, 
        username,
        full_name, 
        email, 
        reto_activo_id, 
        reto_dia_actual, 
        reto_fecha_inicio, 
        reto_completado, 
        reto_ultimo_completado,
        retos ( nombre )
      `)
      .not('reto_activo_id', 'is', null);
      
    if (error) {
      console.error("Error fetching retos:", error);
      setLoading(false);
      return;
    } 

    if (data && data.length > 0) {
      const userIds = data.map(u => u.id);
      
      const { data: habitsData } = await supabase
        .from('habitos_diarios')
        .select('user_id, agua, sueno, comida_sana, foto_url')
        .in('user_id', userIds);

      const processedUsers = data.map(user => {
        let score = 0;
        const userHabits = (habitsData || []).filter(h => h.user_id === user.id);
        
        // Count routines based on challenge progress
        const routineCount = user.reto_completado ? 21 : Math.max(0, user.reto_dia_actual - 1);
        score += routineCount * 10;
        
        userHabits.forEach(h => {
           if (h.foto_url) score += 5;
           if (h.comida_sana) score += 5;
           if (h.agua >= 3) score += 2;
           if (h.sueno >= 7) score += 3;
        });
        
        return { ...user, score, habit_count: userHabits.length, routine_count: routineCount };
      });
      
      // Sort by score (descending)
      processedUsers.sort((a, b) => b.score - a.score);
      setParticipantes(processedUsers);
    } else {
      setParticipantes([]);
    }
    
    setLoading(false);
  };

  const filtered = participantes.filter(p => 
    (p.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (viewingUserId) {
    const selectedUser = participantes.find(p => p.id === viewingUserId);
    return (
      <div style={{ marginTop: '20px' }}>
        <button onClick={() => setViewingUserId(null)} style={{ background: 'transparent', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', border: 'none', padding: 0 }}>
          <ChevronLeft size={20} /> Volver a participantes
        </button>
        <h2 style={{ marginBottom: '5px', color: 'white' }}>Hábitos de {selectedUser?.full_name}</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>{selectedUser?.email}</p>
        
        <GaleriaReto userId={viewingUserId} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: 'var(--accent-gold)' }}>Leaderboard: Retos 21 Días</h2>
        <div style={{ backgroundColor: 'rgba(212,175,55,0.1)', padding: '5px 15px', borderRadius: '20px', color: 'var(--accent-gold)' }}>
          {participantes.length} Participantes
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search size={20} color="#888" style={{ position: 'absolute', left: '15px', top: '15px' }} />
        <input 
          type="text" 
          placeholder="Buscar por nombre o email..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field"
          style={{ width: '100%', paddingLeft: '45px' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><i className="fa-solid fa-circle-notch fa-spin gold-gradient-text" style={{ fontSize: '2rem' }}></i></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {filtered.map((p, index) => {
            const isWinner = p.reto_completado;

            // Determine ranking colors
            let rankColor = 'var(--text-muted)';
            let rankIcon = null;
            let rankBg = 'var(--bg-card)';
            
            if (index === 0) {
                rankColor = 'var(--accent-gold)';
                rankIcon = <Trophy size={20} color="var(--accent-gold)" />;
                rankBg = 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(20,20,20,0.9) 100%)';
            } else if (index === 1) {
                rankColor = '#c0c0c0'; // Silver
                rankIcon = <Medal size={20} color="#c0c0c0" />;
                rankBg = 'linear-gradient(135deg, rgba(192, 192, 192, 0.1) 0%, rgba(20,20,20,0.9) 100%)';
            } else if (index === 2) {
                rankColor = '#cd7f32'; // Bronze
                rankIcon = <Medal size={20} color="#cd7f32" />;
                rankBg = 'linear-gradient(135deg, rgba(205, 127, 50, 0.1) 0%, rgba(20,20,20,0.9) 100%)';
            }
            
            return (
              <div key={p.id} className="card" style={{ 
                border: `1px solid ${index < 3 ? rankColor : 'rgba(255,255,255,0.1)'}`,
                background: rankBg,
                position: 'relative'
              }}>
                <div style={{ position: 'absolute', top: '-10px', left: '-10px', width: '30px', height: '30px', borderRadius: '50%', background: rankColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold', fontSize: '1rem', border: '2px solid #111' }}>
                  {index + 1}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: '15px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {rankIcon}
                      {p.full_name || p.username || 'Usuario'}
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 0 10px 0' }}>{p.email}</p>
                    <p style={{ color: 'white', fontSize: '0.85rem', margin: '0 0 5px 0', background: 'rgba(255,255,255,0.1)', display: 'inline-block', padding: '2px 8px', borderRadius: '10px' }}>
                      {p.retos?.nombre || 'Reto Desconocido'}
                    </p>
                    {p.reto_fecha_inicio && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '5px 0 0 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={12} />
                        Inscrito: {new Date(p.reto_fecha_inicio).toLocaleString('es-MX', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', hour12: true
                        })}
                      </p>
                    )}
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold', fontSize: '1.5rem', marginBottom: '5px' }}>
                      {p.score} <span style={{ fontSize: '0.8rem', color: '#aaa' }}>pts</span>
                    </div>
                    {isWinner ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ color: '#44bd32', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <CheckCircle size={12} /> Completado
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ color: '#4bcffa', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '1rem' }}>
                          Día {p.reto_dia_actual}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', marginTop: '15px', color: '#aaa', fontSize: '0.85rem', paddingLeft: '15px' }}>
                   <span><Activity size={12} style={{marginRight: '3px'}}/> {p.routine_count} misiones</span>
                   <span><CheckCircle size={12} style={{marginRight: '3px'}}/> {p.habit_count} registros</span>
                </div>
                
                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
                  <button 
                    onClick={() => setViewingUserId(p.id)}
                    className="btn-secondary" 
                    style={{ padding: '6px 12px', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Eye size={16} /> Ver Hábitos y Horarios
                  </button>
                </div>
              </div>
            );
          })}
          
          {filtered.length === 0 && (
            <p style={{ textAlign: 'center', color: '#888', padding: '20px' }}>No hay participantes en retos todavía.</p>
          )}
        </div>
      )}
    </div>
  );
}
