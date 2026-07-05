@echo off
echo ========================================================
echo   COMPILANDO Y PUBLICANDO VETA VIGOR APP EN CLOUDFLARE
echo ========================================================
echo.
echo Paso 1: Compilando aplicacion...
call npm run build
if %errorlevel% neq 0 (
  echo Error compilando la app.
  pause
  exit /b %errorlevel%
)
echo.
echo Paso 2: Subiendo a Cloudflare...
call npx wrangler pages deploy dist --project-name=veta-vigor-app
echo.
echo ========================================================
echo   PUBLICACION COMPLETADA
echo ========================================================
pause
