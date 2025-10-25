@echo off
echo ============================================
echo  Claude Code - Instalacao Global de MCPs
echo ============================================
echo.

REM Verificar se o template existe
if not exist "docs\setup\claude-code-global-config.json" (
    echo [ERRO] Template nao encontrado!
    echo Certifique-se de estar no diretorio raiz do projeto.
    pause
    exit /b 1
)

REM Criar arquivo global
echo [INFO] Copiando configuracao global...
copy /Y "docs\setup\claude-code-global-config.json" "%USERPROFILE%\.claude.json"

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo  [SUCESSO] Configuracao global instalada!
    echo ============================================
    echo.
    echo Localizado em: %USERPROFILE%\.claude.json
    echo.
    echo Agora voce pode usar os MCPs do RotaMestre
    echo em qualquer projeto com Claude Code!
    echo.
    echo Proximo passo:
    echo   claude mcp list
    echo.
) else (
    echo.
    echo [ERRO] Falha ao copiar arquivo.
    echo Verifique as permissoes.
    echo.
)

pause
