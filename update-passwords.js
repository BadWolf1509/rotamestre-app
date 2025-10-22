const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

(async () => {
  console.log('🔑 Atualizando senhas...\n');

  const { data: { users } } = await supabase.auth.admin.listUsers();

  for (const user of users) {
    let senha;
    if (user.email.includes('gestor')) {
      senha = 'gestor123';
    } else if (user.email.includes('motorista')) {
      senha = 'motorista123';
    } else {
      continue;
    }

    console.log(`${user.email} → ${senha}`);

    const { error } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: senha }
    );

    if (error) {
      console.log(`  ❌ Erro: ${error.message}`);
    } else {
      console.log(`  ✅ Senha atualizada!`);
    }
  }

  console.log('\n✅ Pronto!\n');
  console.log('📋 Credenciais corretas:');
  console.log('   gestor@rotamestre.tec.br / gestor123');
  console.log('   motorista@rotamestre.tec.br / motorista123\n');
  console.log('🌐 Teste em: http://localhost:8081/auth/login\n');
})();