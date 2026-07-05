# Tareas de Implementación: Progreso Corporal

- `[x]` 1. Integración de `composicion.html` con React
  - `[x]` Modificar `public/composicion.html` para emitir `postMessage` con los datos calculados.
  - `[x]` Modificar `src/pages/WebTool.jsx` para escuchar el `message` y guardar `peso`, `grasa`, `masaMuscular` en `user_metadata`.
- `[x]` 2. Interfaz de Progreso en `Perfil.jsx`
  - `[x]` Leer métricas (`peso_inicial`, `peso`, `grasa`, `masa_muscular`) de `user_metadata` y mostrarlas en una cuadrícula premium.
  - `[x]` Añadir botón "Editar" para abrir un modal manual (útil para Peso Inicial o si no quieren usar la calculadora).
  - `[x]` Crear modal con formulario para actualizar `peso_inicial` y `peso_actual`.
- `[x]` 3. Fotos de "Antes y Después"
  - `[x]` Crear sección de UI "Transformación Visual" con marcos de Antes y Después.
  - `[x]` Implementar uploader apuntando al bucket `fotos_progreso` de Supabase Storage.
  - `[x]` Guardar las URLs generadas en `user_metadata` como `foto_antes` y `foto_despues`.
- `[x]` 4. Pruebas y Walkthrough
