@echo off
echo ================================================
echo    Configuracao do Android SDK para RotaMestre
echo ================================================
echo.

REM Detectar localizacao do Android SDK
set "SDK_DEFAULT=%LOCALAPPDATA%\Android\Sdk"
set "SDK_USER=%USERPROFILE%\Android\Sdk"
set "SDK_PROGRAMFILES=%ProgramFiles%\Android\Android Studio\jbr"

if exist "%SDK_DEFAULT%" (
    set "ANDROID_SDK=%SDK_DEFAULT%"
    echo [OK] SDK encontrado em: %SDK_DEFAULT%
) else if exist "%SDK_USER%" (
    set "ANDROID_SDK=%SDK_USER%"
    echo [OK] SDK encontrado em: %SDK_USER%
) else (
    echo [ERRO] Android SDK nao encontrado!
    echo.
    echo Por favor, abra o Android Studio e va em:
    echo File ^> Settings ^> Appearance ^&^& Behavior ^> System Settings ^> Android SDK
    echo.
    echo Copie o caminho "Android SDK Location" e execute:
    echo setx ANDROID_HOME "caminho_copiado"
    pause
    exit /b 1
)

echo.
echo Configurando variaveis de ambiente...
echo.

REM Configurar ANDROID_HOME
setx ANDROID_HOME "%ANDROID_SDK%"
echo [1/3] ANDROID_HOME = %ANDROID_SDK%

REM Configurar JAVA_HOME (JBR do Android Studio)
set "JAVA_PATH_1=C:\Program Files\Android\Android Studio\jbr"
set "JAVA_PATH_2=%LOCALAPPDATA%\Programs\Android\Android Studio\jbr"

if exist "%JAVA_PATH_1%" (
    setx JAVA_HOME "%JAVA_PATH_1%"
    echo [2/3] JAVA_HOME = %JAVA_PATH_1%
) else if exist "%JAVA_PATH_2%" (
    setx JAVA_HOME "%JAVA_PATH_2%"
    echo [2/3] JAVA_HOME = %JAVA_PATH_2%
) else (
    echo [AVISO] JBR do Android Studio nao encontrado
    echo Usando Java do sistema
)

REM Adicionar ao PATH
set "NEW_PATH=%ANDROID_SDK%\platform-tools;%ANDROID_SDK%\emulator;%ANDROID_SDK%\tools;%ANDROID_SDK%\tools\bin"
echo [3/3] Adicionando ao PATH: platform-tools, emulator, tools

echo.
echo ================================================
echo    IMPORTANTE: Reinicie o terminal para aplicar
echo ================================================
echo.
echo Comandos para verificar:
echo   echo %%ANDROID_HOME%%
echo   adb version
echo   emulator -list-avds
echo.

pause