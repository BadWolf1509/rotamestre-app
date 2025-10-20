@echo off
echo.
echo ╔════════════════════════════════════════════════╗
echo ║   Aplicar Correção RLS - Quick Apply          ║
echo ╚════════════════════════════════════════════════╝
echo.
echo ⏳ Verificando se Supabase está disponível...
echo.

cd /d "%~dp0"
node apply-rls-direct-db.js

echo.
echo ══════════════════════════════════════════════════
echo.
echo Se falhou, aguarde o Supabase estabilizar.
echo Status: https://status.supabase.com
echo.
pause
