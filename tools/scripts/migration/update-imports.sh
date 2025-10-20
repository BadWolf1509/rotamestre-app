#!/bin/bash

# Script para atualizar imports para usar path aliases

echo "🔄 Atualizando imports para usar path aliases..."

# Função para substituir imports em um arquivo
update_imports() {
    local file="$1"

    # Backup do arquivo
    cp "$file" "$file.bak"

    # Substituir imports relativos por path aliases
    sed -i "s|from '\.\./\.\./lib/|from '@/lib/|g" "$file"
    sed -i "s|from '\.\./\.\./\.\./lib/|from '@/lib/|g" "$file"
    sed -i "s|from '\.\./lib/|from '@/lib/|g" "$file"

    sed -i "s|from '\.\./\.\./hooks/|from '@/hooks/|g" "$file"
    sed -i "s|from '\.\./\.\./\.\./hooks/|from '@/hooks/|g" "$file"
    sed -i "s|from '\.\./hooks/|from '@/hooks/|g" "$file"

    sed -i "s|from '\.\./\.\./types/|from '@/types/|g" "$file"
    sed -i "s|from '\.\./\.\./\.\./types/|from '@/types/|g" "$file"
    sed -i "s|from '\.\./types/|from '@/types/|g" "$file"

    sed -i "s|from '\.\./\.\./components/|from '@/components/|g" "$file"
    sed -i "s|from '\.\./\.\./\.\./components/|from '@/components/|g" "$file"
    sed -i "s|from '\.\./components/|from '@/components/|g" "$file"

    # Remover backup se não houve mudanças
    if diff "$file" "$file.bak" > /dev/null 2>&1; then
        rm "$file.bak"
    else
        echo "  ✅ Updated: $file"
        rm "$file.bak"
    fi
}

# Atualizar todos os arquivos .tsx e .ts
find app -name "*.tsx" -o -name "*.ts" | while read file; do
    update_imports "$file"
done

echo "✅ Imports atualizados!"
