@echo off
echo ========================================================
echo   INICIANDO VETA VIGOR APP (MODO PRUEBA LOCAL)
echo ========================================================
echo.
echo Abriendo la aplicacion en tu navegador...
echo IMPORTANTE: No cierres esta ventana negra mientras estes probando la app.
echo.
start http://localhost:5173
echo Instalando dependencias (por favor espera unos segundos)...
call npm install
call npm run dev
pause
