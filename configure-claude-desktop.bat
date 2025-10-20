@echo off
REM Script para configurar MCPs no Claude Desktop (Windows)

echo ============================================
echo   Configuracao MCPs - Claude Desktop
echo ============================================
echo.

REM Verificar se o diretorio existe
if not exist "%APPDATA%\Claude" (
    echo [ERRO] Diretorio do Claude Desktop nao encontrado!
    echo.
    echo Certifique-se de que o Claude Desktop esta instalado.
    echo Caminho esperado: %APPDATA%\Claude
    echo.
    pause
    exit /b 1
)

REM Criar arquivo se nao existir
if not exist "%APPDATA%\Claude\claude_desktop_config.json" (
    echo [INFO] Arquivo de configuracao nao existe. Criando...
    echo { > "%APPDATA%\Claude\claude_desktop_config.json"
    echo   "mcpServers": {} >> "%APPDATA%\Claude\claude_desktop_config.json"
    echo } >> "%APPDATA%\Claude\claude_desktop_config.json"
    echo [OK] Arquivo criado!
)

echo.
echo [1] Caminhos dos MCPs:
echo.
echo MCP Git:        %CD%\tools\mcp-git-rotamestre\src\index.js
echo MCP Database:   %CD%\tools\mcp-server\src\index.js
echo MCP Filesystem: npx @modelcontextprotocol/server-filesystem %CD%
echo.

echo [2] Arquivo de configuracao:
echo.
echo %APPDATA%\Claude\claude_desktop_config.json
echo.

echo [3] Abrindo arquivo de configuracao...
echo.

REM Abrir arquivo no editor padrao
start "" "%APPDATA%\Claude\claude_desktop_config.json"

echo [4] Aguarde o editor abrir...
timeout /t 2 /nobreak >nul

echo.
echo ============================================
echo   Instrucoes
echo ============================================
echo.
echo 1. Copie a configuracao de CLAUDE_DESKTOP_CONFIG.md
echo 2. Cole no arquivo que acabou de abrir
echo 3. Adicione sua Service Role Key do Supabase
echo 4. Salve o arquivo (Ctrl+S)
echo 5. Feche e reabra o Claude Desktop
echo.
echo Para obter a Service Role Key:
echo https://supabase.com/dashboard/project/xezslsyxjivunmhhyxtd/settings/api
echo.
echo ============================================
echo.

REM Abrir documentacao
choice /C SN /M "Deseja abrir a documentacao de configuracao (CLAUDE_DESKTOP_CONFIG.md)"

if errorlevel 2 goto :end
if errorlevel 1 (
    echo.
    echo [INFO] Abrindo documentacao...
    start "" "%CD%\CLAUDE_DESKTOP_CONFIG.md"
)

:end
echo.
echo [OK] Configuracao concluida!
echo.
echo Proximos passos:
echo - Reinicie o Claude Desktop
echo - Teste com: Use a tool git_status
echo.
pause
