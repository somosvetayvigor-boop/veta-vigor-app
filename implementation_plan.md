# Módulo de Progreso Corporal y Fotos en Perfil

Para cumplir con esta solicitud, transformaremos el `Perfil.jsx` agregando una sección completa dedicada al progreso físico. Además, propongo una integración mágica: que la Calculadora de Composición Corporal actualice estas métricas automáticamente, al igual que lo hicimos con la fuerza.

## Propósito y Contexto
Los atletas necesitan visualizar su evolución. Añadiremos un panel de "Métricas Corporales" y una galería comparativa de "Antes y Después" en su perfil.

## Cambios Propuestos

### 1. Sección de Métricas en el Perfil
*   Se añadirá una cuadrícula en `Perfil.jsx` que mostrará:
    *   **Peso Inicial** vs **Peso Actual**
    *   **Porcentaje de Grasa**
    *   **Masa Muscular** (kg)
*   Se añadirá un botón rápido de "Actualizar Métricas" que abrirá un pequeño formulario para editar estos valores manualmente.

### 2. Integración Mágica con la Calculadora (Bonus)
*   Modificaremos el archivo `composicion.html` para que, cuando el usuario le dé a "Analizar Físico", envíe un mensaje oculto a la aplicación React.
*   La aplicación React atrapará este mensaje y **guardará automáticamente** el peso actual, el porcentaje de grasa y la masa muscular en la base de datos (exactamente igual que hicimos con el récord de fuerza).

### 3. Galería de Fotos "Antes y Después"
*   Se añadirá una sección en el perfil con dos recuadros (Antes y Después).
*   Los usuarios podrán subir fotos desde su dispositivo.

> [!IMPORTANT]
> **User Review Required - Subida de Imágenes**
> Para que los usuarios puedan subir sus fotos de "Antes y Después" y que estas se guarden permanentemente, necesitamos usar **Supabase Storage**.
> ¿Tienes ya configurado un "Bucket" (carpeta en la nube de Supabase) público para subir imágenes? Si no es así, necesitarás ir a tu panel de Supabase, entrar a **Storage**, darle a "New Bucket", nombrarlo `fotos_progreso`, y hacerlo "Público". ¿Estás de acuerdo con este enfoque?

> [!WARNING]
> **Open Question - Peso Inicial**
> El "Peso Inicial" lo pediré en el formulario de "Actualizar Métricas" para que el atleta lo llene una vez. ¿Te parece bien, o prefieres que lo jale automáticamente de la primera vez que completaron el cuestionario inicial de la app? (Dependiendo de si lo guardaste en ese momento).

## Archivos a Modificar
#### [MODIFY] src/pages/Perfil.jsx
*   Añadir la UI para las métricas corporales y el uploader de fotos.
*   Lógica para guardar las URLs de las fotos en `user_metadata`.

#### [MODIFY] src/pages/WebTool.jsx
*   Añadir un `window.addEventListener('message')` para escuchar los datos enviados por la calculadora de composición y guardarlos en Supabase.

#### [MODIFY] public/composicion.html
*   Añadir el código `window.parent.postMessage` al final del cálculo para emitir los resultados hacia la app de React.

---
**Por favor, responde a las preguntas resaltadas antes de comenzar a programar.**
