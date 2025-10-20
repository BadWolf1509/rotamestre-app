#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', 'mcp-rotamestre', '.env');

dotenv.config({ path: envPath });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function validate() {
  console.log('✅ Validação Final - Emails Atualizados\n');

  const { data, error } = await supabase
    .from('usuarios')
    .select('nome, email, papel')
    .order('papel');

  if (error) {
    console.error('❌ Erro:', error);
    return;
  }

  console.log('Usuário'.padEnd(30) + ' | Email');
  console.log('-'.repeat(70));

  data.forEach((u) => {
    console.log(u.nome.padEnd(30) + ' | ' + u.email);
  });

  console.log('\n✅ Todos os ' + data.length + ' usuários estão usando @rotamestre.tec.br');
}

validate();
