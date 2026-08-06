# Estado Actual: Comunidad + Sistemas y Retos

Aquí tienes la lectura técnica y el estado actual de los módulos solicitados, basada exclusivamente en el código real.

## 1. MAPA ACTUAL DE COMUNIDAD

**Jerarquía Visual:**
La pestaña Comunidad se divide mediante dos botones (pestañas) superiores:
1. **Tribu VIP** (Feed de mensajes)
2. **Muro del Vigor** (Ranking y Atleta del Mes)

**MURO DEL VIGOR (Leaderboard)**
- **Componente:** `Comunidad.jsx` (líneas 752-772).
- **Fuente de Datos:** Función RPC `get_leaderboard`.
- **Métrica y Ordenamiento:** El código frontend asigna insignias según la cantidad total de entrenamientos (`user.total_workouts`). El orden y el periodo los define el RPC internamente en base de datos.
- **Cuándo se actualiza:** Cada vez que el usuario hace clic en la pestaña "Muro del Vigor".
- **Cantidad mostrada:** Depende de lo que devuelva el RPC en bloque. El frontend mapea todo el array y resalta los primeros tres.
- **Condicional relevante:** Visible para cualquier usuario que abra la pestaña.

**ATLETA DEL MES (Banner destacado)**
- **Componente:** `Comunidad.jsx` (líneas 720-750).
- **Aparición:** Se renderiza como un banner grande con efecto de "fuego" encima de la lista del Muro del Vigor.
- **Fuente de Datos:** Tabla `muro_fama` unida (JOIN) a la tabla `perfiles`.
- **Campos utilizados:** `mes_anio`, `frase_motivadora`, `perfiles.full_name`, `perfiles.avatar_url`.
- **Selección (Lógica):** Gerardo/Admin lo selecciona manualmente al cambiar la columna `estado` a `'publicado'`. El sistema busca el más reciente (`order by created_at desc, limit 1`) que esté publicado.
- **Condicionales de Aparición:** 
  1. Que exista al menos un registro publicado. 
  2. Que el usuario visualizando la app tenga una suscripción de pago o sea Admin. Si el usuario es gratuito, **no ve el banner del Atleta del Mes**.
- **Ausencia:** Si no existe registro publicado, el banner simplemente colapsa y no aparece.
- **Consentimiento:** En este componente de lectura, no existe ninguna lógica de validación de consentimiento del atleta.

---

## 2. MAPA ACTUAL DE SISTEMAS Y RETOS

**Nombre Público Actual:** 
A nivel visual superior (Dashboard), la pantalla no muestra un título de "Sistemas y Retos", sino un saludo: `"Bienvenido de vuelta, [Nombre]"`.

**Jerarquía Real de Navegación:**
Los **Retos** no son una subpestaña ni están dentro de Sistemas/Rutas. Se muestran como **Banners / Tarjetas fijas** en la parte superior de la pantalla.
Debajo de los Retos, existen **dos botones tipo "Tabs"**:
1. Sistemas Base
2. Rutas de Maestría

**SISTEMAS BASE**
- **Componente:** `Dashboard.jsx`.
- **Fuente de Datos:** Tabla `sistemas_entrenamiento`.
- **Sistemas visibles:** El código filtra todos los registros cuyo nombre **NO** incluya las palabras "Maestría" o "Ruta".
- **Condiciones:** Se muestran a todos los usuarios. Si es un usuario gratuito, se sobrepone un icono de Candado visualmente opaco.
- **Destino:** Al pulsar, redirige a `/sistema/[id_sistema]`. Si es un usuario gratuito, lo redirige a la pasarela de pago (`/premium`).

**RUTAS DE MAESTRÍA**
- **Componente:** `Dashboard.jsx`.
- **Fuente de Datos:** Misma tabla `sistemas_entrenamiento`.
- **Rutas visibles:** El código filtra todos los registros cuyo nombre **SÍ** incluya "Maestría" o "Ruta".
- **Bloqueo:** En el componente principal no se renderiza candado de bloqueo para usuarios gratuitos en estas tarjetas.
- **Destino:** Al pulsar, redirige libremente a `/sistema/[id_sistema]`.

**RETOS**
- **Componente:** `Dashboard.jsx`.
- **Fuente de Datos:** Tabla `perfiles` (para estado actual) y tabla `retos` (para recomendación).
- **Comportamiento Visible:**
  - **Banner Reto Recomendado:** Aparece si el Atleta NO tiene un reto activo, NO ha completado uno antes, y su nivel no es "Roble". Redirige a `/reto-21-dias?retoId=[id]`.
  - **Banner Reto Activo:** Aparece si el Atleta tiene un reto activo en curso y no lo ha completado. Muestra una barra de progreso. Redirige directamente al reproductor `/reto-21-dias`.
- **Condiciones Adicionales:** No hay forma de ver "Retos futuros" o "Retos cerrados", solo el activo o el recomendado.

**Recorrido del Atleta:**
1. Entra a "Inicio/Dashboard".
2. Si tiene un Reto activo, verá una tarjeta inmensa superior. Puede entrar al Reto directo.
3. Si quiere entrenar normal, selecciona el tab "Sistemas Base" o "Rutas de Maestría".
4. Pulsa sobre la imagen del Sistema/Ruta y entra a la pantalla de detalle.

---

## 3. TABLA DE CORRESPONDENCIA

| Elemento visible | Nombre técnico | Fuente de datos | Automático o manual | Condición de aparición |
| :--- | :--- | :--- | :--- | :--- |
| **Muro del Vigor** | `leaderboard` | `rpc('get_leaderboard')` | Automático (Cálculo RPC) | Pulsar el tab correspondiente. Visible para todos. |
| **Atleta Vigor del Mes** | `muroFama` | Tabla `muro_fama` | Manual (`estado='publicado'`) | Solo si el usuario es VIP y existe registro. |
| **Sistemas Base** | `sistemas` | `sistemas_entrenamiento` | Automático | Que el nombre no contenga "Maestría". |
| **Rutas de Maestría** | `sistemas` | `sistemas_entrenamiento` | Automático | Que el nombre contenga "Maestría". |
| **Reto Recomendado** | `recommendedReto` | Tabla `retos` | Automático | Si el Atleta no tiene reto activo ni completado. |
| **Reto Activo** | `reto_activo_id` | Tabla `perfiles` | Automático | Si existe `reto_activo_id` y no está completado. |
| **Pestaña Rutas/Sistemas**| `activeTab` | Estado Local React | Manual (Navegación UI) | Alternable haciendo clic en los botones. |

---

## 4. AMBIGÜEDADES QUE NO PUEDEN RESOLVERSE DESDE EL CÓDIGO (Frontend)

1. **La lógica profunda del Leaderboard:** Dado que el Muro del Vigor utiliza la llamada `supabase.rpc('get_leaderboard')`, las reglas de desempate y los filtros temporales están programados en el servidor de Postgres (Supabase).
2. **Consentimiento del Atleta del Mes:** El código no expone ninguna pantalla o booleano de "Atleta acepta ser nominado". Todo indica que el administrador simplemente marca `estado = 'publicado'` en el panel.
