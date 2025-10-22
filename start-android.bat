@echo off
echo ================================================
echo    RotaMestre - Inicio Rapido Android
echo ================================================
echo.

REM Verificar Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado!
    echo Instale: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/5] Node.js encontrado:
node --version
echo.

REM Verificar ANDROID_HOME
if "%ANDROID_HOME%"=="" (
    echo [AVISO] ANDROID_HOME nao configurado
    echo Execute primeiro: setup-android-env.bat
    echo.
    set /p continue="Continuar mesmo assim? (S/N): "
    if /i not "%continue%"=="S" exit /b 0
) else (
    echo [2/5] ANDROID_HOME configurado: %ANDROID_HOME%
)
echo.

REM Verificar se existe emulador
echo [3/5] Verificando emuladores...
if exist "%ANDROID_HOME%\emulator\emulator.exe" (
    "%ANDROID_HOME%\emulator\emulator.exe" -list-avds > temp_avds.txt
    for /f %%i in ("temp_avds.txt") do set size=%%~zi
    if %size% gtr 0 (
        echo Emuladores disponiveis:
        type temp_avds.txt
        echo.
    ) else (
        echo [AVISO] Nenhum emulador encontrado!
        echo Crie um emulador no Android Studio:
        echo Tools ^> Device Manager ^> Create Device
        pause
    )
    del temp_avds.txt
) else (
    echo [AVISO] Emulator nao encontrado em %ANDROID_HOME%\emulator
)
echo.

REM Verificar dependências
echo [4/5] Verificando dependencias npm...
if not exist "node_modules\" (
    echo Instalando dependencias...
    call npm install
) else (
    echo Dependencias ja instaladas
)
echo.

REM Oferecer opções
echo [5/5] Como deseja executar?
echo.
echo 1. Android Emulator (Build Completo - Primeira vez)
echo 2. Android Emulator (Desenvolvimento - Rapido)
echo 3. Web Browser (Mais rapido para testes)
echo 4. Apenas iniciar Metro Bundler
echo 5. Verificar dispositivos conectados
echo 6. Sair
echo.

set /p choice="Escolha uma opcao (1-6): "

if "%choice%"=="1" (
    echo.
    echo Iniciando build Android completo...
    echo IMPORTANTE: Primeira execucao pode levar 5-10 minutos
    echo.
    call npm run android
) else if "%choice%"=="2" (
    echo.
    echo Iniciando desenvolvimento Android...
    echo.
    start "Metro Bundler" cmd /c "npm start"
    timeout /t 3
    echo.
    echo Pressione 'a' no Metro Bundler para abrir no Android
    echo Ou execute: npm run android
    pause
) else if "%choice%"=="3" (
    echo.
    echo Iniciando versao web...
    echo Acesse: http://localhost:8081
    echo.
    call npm run web
) else if "%choice%"=="4" (
    echo.
    echo Iniciando Metro Bundler...
    echo.
    call npm start
) else if "%choice%"=="5" (
    echo.
    echo Verificando dispositivos conectados...
    echo.
    if exist "%ANDROID_HOME%\platform-tools\adb.exe" (
        "%ANDROID_HOME%\platform-tools\adb.exe" devices
    ) else (
        echo ADB nao encontrado
    )
    echo.
    pause
    call start-android.bat
) else if "%choice%"=="6" (
    echo.
    echo Ate logo!
    timeout /t 2
    exit /b 0
) else (
    echo.
    echo Opcao invalida!
    timeout /t 2
    call start-android.bat
)