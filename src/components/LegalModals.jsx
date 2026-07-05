import React from 'react';
import { X } from 'lucide-react';

export default function LegalModals({ type, onClose }) {
  if (!type) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1200, display: 'flex',
      justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)', padding: '20px'
    }}>
      <div style={{ background: '#111', border: '1px solid var(--accent-gold)', borderRadius: '20px', padding: '25px', width: '100%', maxWidth: '500px', maxHeight: '80vh', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
        <h3 style={{ color: 'var(--accent-gold)', marginTop: 0, marginBottom: '20px', paddingRight: '30px' }}>
          {type === 'privacy' ? 'Aviso de Privacidad' : 'Términos y Condiciones'}
        </h3>
        
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '10px', fontSize: '0.85rem', color: '#ccc', lineHeight: '1.6' }}>
          {type === 'privacy' ? (
            <>
              <p><strong>Última actualización: 13 de junio de 2026</strong></p>
              <h4 style={{ color: 'var(--accent-gold)', marginTop: '15px' }}>1. Identidad y Domicilio del Responsable</h4>
              <p>Veta & Vigor (en adelante "El Responsable"), con domicilio en Mérida, Yucatán, México, es responsable del tratamiento y protección de sus datos personales, los cuales serán manejados bajo estrictas medidas de confidencialidad y seguridad de acuerdo con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y estándares internacionales aplicables.</p>
              
              <h4 style={{ color: 'var(--accent-gold)', marginTop: '15px' }}>2. Datos Personales que se Recaban</h4>
              <p>Para brindarle acceso a nuestra aplicación, gestionar su membresía y su participación en nuestros programas (como retos y progresiones), recabaremos los siguientes datos:</p>
              <ul style={{ paddingLeft: '20px', marginBottom: '10px' }}>
                <li><strong>Datos de Identificación y Contacto:</strong> Nombre completo, correo electrónico y apodo o nombre de usuario (para visualización en la comunidad).</li>
                <li><strong>Datos Sensibles (Físicos y de Salud):</strong> Peso, estatura, medidas corporales (contornos), edad y fotografías de progreso físico (imágenes de "antes y después"). Al proporcionar estos datos, usted otorga su consentimiento expreso para su tratamiento conforme a este aviso.</li>
              </ul>
              
              <h4 style={{ color: 'var(--accent-gold)', marginTop: '15px' }}>3. Finalidad del Uso de los Datos</h4>
              <p>Sus datos serán utilizados exclusivamente para las siguientes finalidades:</p>
              <ul style={{ paddingLeft: '20px', marginBottom: '10px' }}>
                <li><strong>Finalidades Primarias (Necesarias para el servicio):</strong> Crear su perfil de usuario, calcular algoritmos de progresión física (asignación de niveles), dar seguimiento automatizado a su plan de entrenamiento, evaluar su evolución física a través de las medidas y fotografías proporcionadas, y mantener el correcto funcionamiento de la plataforma web.</li>
                <li><strong>Finalidades Secundarias (Voluntarias):</strong> Fomentar la motivación dentro de la tribu. Su "Apodo" y fotografías de progreso podrán ser visibles únicamente dentro de los muros internos de la aplicación para otros miembros de la comunidad, dependiendo de su configuración de privacidad y nivel de membresía.</li>
              </ul>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid var(--accent-gold)', marginBottom: '10px' }}>
                <strong>Garantía de Privacidad de Imagen:</strong> Ninguna fotografía de progreso corporal será compartida, vendida, ni utilizada en redes sociales públicas (Instagram, Facebook, material publicitario, etc.) sin solicitar y obtener previamente un permiso por escrito adicional y específico por parte suya.
              </div>

              <h4 style={{ color: 'var(--accent-gold)', marginTop: '15px' }}>4. Almacenamiento, Seguridad y Retención de Datos</h4>
              <p>Sus datos personales y fotografías se almacenan en servidores en la nube de alta seguridad con encriptación de extremo a extremo. Los datos sensibles y fotografías se conservarán únicamente mientras su cuenta permanezca activa. Si usted decide eliminar su cuenta, todas sus fotografías, medidas y registros físicos serán destruidos y purgados de nuestros servidores de forma permanente e irrecuperable.</p>
              
              <h4 style={{ color: 'var(--accent-gold)', marginTop: '15px' }}>5. Derechos ARCO</h4>
              <p>Usted tiene derecho en todo momento a conocer qué datos tenemos (Acceso), a corregirlos (Rectificación), a solicitar que eliminemos sus fotografías, medidas o cuenta completa de nuestra base de datos (Cancelación), o a oponerse a su uso para finalidades secundarias (Oposición).</p>
              <p>Para ejercer cualquiera de estos derechos, envíe un correo electrónico a: <strong>somos.vetayvigor@gmail.com</strong></p>
              
              <h4 style={{ color: 'var(--accent-gold)', marginTop: '15px' }}>6. Cambios al Aviso de Privacidad</h4>
              <p>Cualquier modificación a este Aviso de Privacidad será notificada a través de una alerta dentro de la propia aplicación o mediante el correo electrónico registrado en su cuenta.</p>
            </>
          ) : (
            <>
              <p><strong>Última actualización: 13 de junio de 2026</strong></p>
              <p>Bienvenido a Veta & Vigor. Al registrarte, acceder o utilizar nuestra aplicación web progresiva (PWA) y sitio web (en adelante, la "Plataforma"), aceptas estar legalmente sujeto a los siguientes Términos y Condiciones. Si no estás de acuerdo con alguna parte de estos términos, no debes utilizar nuestros servicios ni registrar tus datos físicos.</p>
              
              <h4 style={{ color: 'var(--accent-gold)', marginTop: '15px' }}>1. Uso de la Plataforma y Cuenta de Usuario</h4>
              <p>Para utilizar Veta & Vigor, deberás registrarte proporcionando una dirección de correo electrónico válida. Eres el único responsable de mantener la confidencialidad de tu cuenta y contraseñas. Veta & Vigor se reserva el derecho de suspender o cancelar cuentas que violen estos términos, compartan credenciales de acceso o muestren un comportamiento perjudicial.</p>

              <h4 style={{ color: 'var(--accent-gold)', marginTop: '15px' }}>2. Descargo de Responsabilidad de Salud y Condición Física</h4>
              <div style={{ background: 'rgba(229, 80, 57, 0.1)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid #e55039', marginBottom: '10px' }}>
                <strong>¡LEER CON ATENCIÓN!</strong>
              </div>
              <ul style={{ paddingLeft: '20px', marginBottom: '10px' }}>
                <li><strong>Propósito Educativo:</strong> Veta & Vigor proporciona rutinas de entrenamiento, algoritmos de progresión y consejos únicamente con fines informativos y educativos. NO somos proveedores de atención médica, fisioterapeutas ni rehabilitadores.</li>
                <li><strong>Declaración de Salud:</strong> Al utilizar esta aplicación y seguir los niveles de entrenamiento (Semilla, Pino, Tzalam, Roble), declaras expresa y voluntariamente que te encuentras en buenas condiciones físicas para realizar los ejercicios propuestos.</li>
                <li><strong>Asesoría Médica:</strong> Debes consultar a un médico o profesional de la salud antes de comenzar cualquier programa de ejercicios, especialmente si tienes condiciones médicas preexistentes, lesiones en articulaciones o columna, o si estás embarazada.</li>
                <li><strong>Asunción de Riesgo:</strong> El uso de las rutinas y sistemas de entrenamiento (incluyendo Carga de Hierro y Vigor Corporal) es bajo tu propio y exclusivo riesgo. Veta & Vigor, sus creadores, desarrolladores, entrenadores y afiliados no se hacen responsables, legal ni financieramente, por ninguna lesión, daño físico, desgarro muscular o problema de salud directo o indirecto que pueda resultar de la ejecución de los ejercicios mostrados en la Plataforma.</li>
              </ul>

              <h4 style={{ color: 'var(--accent-gold)', marginTop: '15px' }}>3. Fotografías de Progreso y Datos Sensibles</h4>
              <p>Al subir voluntariamente fotografías de tu cuerpo ("antes y después") y registrar tus medidas corporales para uso del algoritmo de la plataforma:</p>
              <ul style={{ paddingLeft: '20px', marginBottom: '10px' }}>
                <li>Garantizas que las fotografías subidas son de tu propia persona.</li>
                <li>Comprendes que la Plataforma cuenta con herramientas para que dichas fotografías puedan ser visibles para otros miembros de la "tribu" interna. Es tu responsabilidad gestionar la configuración de privacidad (si aplica) o decidir qué nivel de exposición deseas tener dentro de la comunidad cerrada.</li>
                <li>Queda estrictamente prohibido subir imágenes que contengan desnudos explícitos, contenido sexual o violento. Veta & Vigor eliminará inmediatamente cualquier cuenta que viole esta norma.</li>
              </ul>

              <h4 style={{ color: 'var(--accent-gold)', marginTop: '15px' }}>4. Suscripciones, Pagos y Reembolsos</h4>
              <p>Veta & Vigor ofrece acceso a contenido Premium a través de diferentes planes de membresía.</p>
              <ul style={{ paddingLeft: '20px', marginBottom: '10px' }}>
                <li><strong>Procesamiento:</strong> Todos los pagos se procesan de forma segura a través de pasarelas de pago certificadas de terceros (ej. Stripe). Veta & Vigor no almacena los datos de tu tarjeta de crédito o débito en sus servidores.</li>
                <li><strong>Renovaciones:</strong> Las suscripciones recurrentes se renovarán automáticamente al final de cada ciclo de facturación. Puedes cancelar tu suscripción en cualquier momento a través del portal de gestión de tu cuenta para evitar futuros cobros.</li>
                <li><strong>Política de Reembolso:</strong> Debido a la naturaleza de entrega inmediata del contenido digital, <strong>todos los pagos realizados NO son reembolsables</strong>, salvo que la ley local exija estrictamente lo contrario. La cancelación detendrá cobros futuros, pero no generará devoluciones prorrateadas por el mes o periodo en curso.</li>
              </ul>

              <h4 style={{ color: 'var(--accent-gold)', marginTop: '15px' }}>5. Propiedad Intelectual</h4>
              <p>Todo el contenido presente en Veta & Vigor (textos, algoritmos de progresión, rutinas, videos, gráficos, logotipos, diseño de la interfaz web y metodologías de entrenamiento) está protegido por leyes de propiedad intelectual y derechos de autor, siendo propiedad exclusiva de Veta & Vigor. Queda estrictamente prohibida su copia, extracción de datos (scraping), distribución, reventa o uso con fines comerciales sin nuestro consentimiento previo y por escrito.</p>

              <h4 style={{ color: 'var(--accent-gold)', marginTop: '15px' }}>6. Normas de la Comunidad</h4>
              <p>Si la Plataforma incluye foros, muros de progreso o espacios de interacción entre usuarios, te comprometes a mantener un ambiente de respeto absoluto. Cualquier tipo de acoso, críticas destructivas al físico de otros usuarios, lenguaje ofensivo, spam o comportamiento inapropiado resultará en la expulsión inmediata y permanente de la plataforma sin derecho a reembolso.</p>

              <h4 style={{ color: 'var(--accent-gold)', marginTop: '15px' }}>7. Modificaciones de los Términos</h4>
              <p>Nos reservamos el derecho de modificar estos Términos y Condiciones en cualquier momento. Los cambios entrarán en vigor inmediatamente después de su publicación en la Plataforma. Es tu responsabilidad revisar estos términos periódicamente. El uso continuado de la PWA implica la aceptación de dichos cambios.</p>

              <h4 style={{ color: 'var(--accent-gold)', marginTop: '15px' }}>8. Contacto</h4>
              <p>Si tienes alguna duda, requerimiento de eliminación de datos o necesitas soporte relacionado con estos términos, contáctanos enviando un correo a: <strong>somos.vetayvigor@gmail.com</strong></p>
            </>
          )}
        </div>
        
        <button onClick={onClose} className="btn-primary" style={{ marginTop: '20px', padding: '15px', fontWeight: 'bold' }}>Entendido</button>
      </div>
    </div>
  );
}
