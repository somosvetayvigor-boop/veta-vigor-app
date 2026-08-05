@echo off
echo ========================================================
echo   GENERANDO APK PARA PRUEBAS RAPIDAS
echo ========================================================
echo.
echo Paso 1: Instalando dependencias...
call npm install --legacy-peer-deps
echo Paso 2: Compilando la aplicacion web...
call npm run build
echo Paso 3: Sincronizando el motor nativo de Android...
call npx cap sync android
echo Paso 4: Construyendo el archivo APK instalable...
cd android
set JAVA_HOME=C:\Users\grd_a\.bubblewrap\jdk\microsoft\jdk-17.0.19+10
set ANDROID_HOME=C:\Users\grd_a\.bubblewrap\android_sdk
set /p KEYSTORE_PASSWORD="Por favor, escribe la contrasena de tu app (la que pusiste la primera vez) y presiona Enter: "
call gradlew.bat assembleRelease
cd ..
echo.
echo ========================================================
echo   ¡PROCESO COMPLETADO EXITOSAMENTE!
echo ========================================================
echo.
echo Tu NUEVO archivo instalable (.apk) se ha guardado en la siguiente ruta:
echo.
echo C:\Users\grd_a\.gemini\antigravity\scratch\Veta_Vigor_App\android\app\build\outputs\apk\release\app-release.apk
echo.
echo 1. Pasate este archivo a tu celular (por WhatsApp, Telegram, o cable USB).
echo 2. Abrelo en tu celular e instalalo (te pedira permiso para instalar apps desconocidas).
pause
