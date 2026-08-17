export default function PruebaPlatinoPorTerminarModal({ onClose }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(10, 10, 15, 0.95)', backdropFilter: 'blur(10px)',
      zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '20px'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '30px 20px', border: '1px solid #fa8231' }}>
        <h2 style={{ color: '#fa8231', fontSize: '1.6rem', marginBottom: '15px' }}>
          Prueba Platino por terminar
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '25px' }}>
          Tu periodo de prueba de 7 días está a punto de caducar (o ya ha caducado). ¡No pierdas tu progreso! Elige un plan para continuar entrenando como un profesional.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => {
              onClose();
              window.location.href = '/sistemas';
            }}
            className="btn-primary"
            style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}
          >
            Ver Planes de Suscripción
          </button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#888', padding: '10px', textDecoration: 'underline' }}
          >
            Continuar con versión gratis
          </button>
        </div>
      </div>
    </div>
  );
}
