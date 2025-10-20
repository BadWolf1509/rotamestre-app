@echo off
echo ========================================
echo ATUALIZANDO FAVICONS - RotaMestre
echo ========================================
echo.

REM Verificar se o novo icon.png existe
if not exist "assets\icon.png" (
    echo [ERRO] Arquivo assets\icon.png nao encontrado!
    echo.
    echo Por favor, salve a imagem do capacete laranja como:
    echo   assets\icon.png
    echo.
    pause
    exit /b 1
)

echo [1/5] Fazendo backup do icon antigo...
if exist "assets\icon-backup.png" (
    echo Backup ja existe, pulando...
) else (
    copy "assets\icon.png" "assets\icon-backup.png" >nul 2>&1
    echo Backup criado: assets\icon-backup.png
)
echo.

echo [2/5] Copiando novo icon para todas as variacoes...
copy "assets\icon.png" "assets\favicon.png" /Y >nul
copy "assets\icon.png" "assets\adaptive-icon.png" /Y >nul
copy "assets\icon.png" "assets\splash-icon.png" /Y >nul
echo Arquivos copiados:
echo   - assets\favicon.png
echo   - assets\adaptive-icon.png
echo   - assets\splash-icon.png
echo.

echo [3/5] Limpando cache do Expo...
if exist ".expo\web" (
    rmdir /s /q ".expo\web" >nul 2>&1
    echo Cache limpo!
)
echo.

echo [4/5] Gerando novos favicons (pode demorar 20-30 segundos)...
call npx expo export --platform web --clear
if errorlevel 1 (
    echo [ERRO] Falha ao gerar favicons!
    pause
    exit /b 1
)
echo.

echo [5/5] Verificando arquivos gerados...
echo.
echo Favicons gerados em dist\:
dir dist\favicon*.* /b 2>nul
dir dist\icon*.* /b 2>nul
dir dist\apple-touch-icon.png /b 2>nul
echo.

echo ========================================
echo SUCESSO! Favicons atualizados!
echo ========================================
echo.
echo Proximos passos:
echo   1. Revisar os arquivos em dist\
echo   2. Executar: git add assets dist
echo   3. Executar: git commit -m "feat: Atualiza favicons com novo icone"
echo   4. Executar: git push
echo   5. Aguardar deploy automatico (1-2 min)
echo   6. Limpar cache do navegador (Ctrl+Shift+Delete)
echo   7. Testar em https://app.rotamestre.tec.br
echo.
pause
