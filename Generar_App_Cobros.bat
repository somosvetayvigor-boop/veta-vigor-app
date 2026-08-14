@echo off
echo ========================================================
echo   COMPILANDO NUEVA VERSION DE LA APP CON REVENUECAT
echo ========================================================
echo.
echo Paso 1: Instalando dependencias...
call npm install --legacy-peer-deps
echo Paso 2: Compilando la aplicacion web...
call npm run build
echo Paso 3: Sincronizando el motor nativo de Android...
call npx cap sync android
echo Paso 4: Construyendo el archivo final (.aab) para Google Play...
cd android
REM Capacitor 8 compila con JavaVersion.VERSION_21. El JDK 17 sigue instalado
REM en .bubblewrap por si hiciera falta volver a Capacitor 6.
set JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.12.8-hotspot
set ANDROID_HOME=C:\Users\grd_a\.bubblewrap\android_sdk
set /p KEYSTORE_PASSWORD="Por favor, escribe la contrasena de tu app (la que pusiste la primera vez) y presiona Enter: "
call gradlew.bat bundleRelease
cd ..
echo.
echo ========================================================
echo   ¡PROCESO COMPLETADO EXITOSAMENTE!
echo ========================================================
echo.
echo Tu NUEVO archivo para subir a Google Play se ha guardado en la siguiente ruta:
echo.
echo C:\Users\grd_a\.gemini\antigravity\scratch\Veta_Vigor_App\android\app\build\outputs\bundle\release\app-release.aab
echo.
echo 1. Sube este archivo en la seccion "Pruebas internas" de Google Play Console.
echo 2. Despues de subirlo, se desbloqueara la pantalla de "Suscripciones".
pause
