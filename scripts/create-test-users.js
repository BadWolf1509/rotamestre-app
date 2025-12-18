/**
 * Script to create test users for E2E testing
 * Run with: node scripts/create-test-users.js
 */
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const TEST_USERS = [
  {
    email: 'motorista.test@rotamestre.tec.br',
    password: 'Test@123456',
    nome: 'Motorista Teste E2E',
    papel: 'motorista',
    telefone: '(00) 00000-0001',
  },
  {
    email: 'gestor.test@rotamestre.tec.br',
    password: 'Test@123456',
    nome: 'Gestor Teste E2E',
    papel: 'gestor',
    telefone: '(00) 00000-0002',
  },
];

async function getFirstUnit() {
  const { data, error } = await supabase
    .from('unidades')
    .select('id, nome')
    .eq('ativa', true)
    .limit(1)
    .single();

  if (error) {
    console.error('❌ Failed to get unit:', error.message);
    return null;
  }

  return data;
}

async function createTestUser(user, unidadeId) {
  console.log(`\n📝 Creating user: ${user.email}`);

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log(`   ⚠️  User already exists in auth, fetching...`);

      // Get existing user
      const { data: users } = await supabase.auth.admin.listUsers();
      const existingUser = users?.users?.find((u) => u.email === user.email);

      if (existingUser) {
        // Update password
        await supabase.auth.admin.updateUserById(existingUser.id, {
          password: user.password,
        });
        console.log(`   ✅ Password updated for existing auth user`);

        // Check if profile exists
        const { data: profile } = await supabase
          .from('usuarios')
          .select('id')
          .eq('id', existingUser.id)
          .single();

        if (!profile) {
          // Create profile
          const { error: profileError } = await supabase.from('usuarios').insert({
            id: existingUser.id,
            email: user.email,
            nome: user.nome,
            papel: user.papel,
            telefone: user.telefone,
            unidade_id: unidadeId,
            ativo: true,
            primeira_senha: false,
          });

          if (profileError) {
            console.log(`   ❌ Failed to create profile: ${profileError.message}`);
          } else {
            console.log(`   ✅ Profile created`);
          }
        } else {
          console.log(`   ✅ Profile already exists`);
        }

        return existingUser.id;
      }
    }

    console.error(`   ❌ Auth error: ${authError.message}`);
    return null;
  }

  console.log(`   ✅ Auth user created: ${authData.user.id}`);

  // 2. Create profile in usuarios table
  const { error: profileError } = await supabase.from('usuarios').insert({
    id: authData.user.id,
    email: user.email,
    nome: user.nome,
    papel: user.papel,
    telefone: user.telefone,
    unidade_id: unidadeId,
    ativo: true,
    primeira_senha: false,
  });

  if (profileError) {
    console.error(`   ❌ Profile error: ${profileError.message}`);
    return null;
  }

  console.log(`   ✅ Profile created`);
  return authData.user.id;
}

async function main() {
  console.log('🚀 Creating test users for E2E testing\n');
  console.log('Supabase URL:', supabaseUrl);

  // Get first active unit
  const unit = await getFirstUnit();
  if (!unit) {
    console.error('❌ No active unit found. Create a unit first.');
    process.exit(1);
  }

  console.log(`\n📍 Using unit: ${unit.nome} (${unit.id})`);

  // Create test users
  const results = [];
  for (const user of TEST_USERS) {
    const userId = await createTestUser(user, unit.id);
    results.push({ ...user, userId, success: !!userId });
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log('='.repeat(50));

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.email} (${result.papel})`);
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(`\nTotal: ${successCount}/${results.length} users created`);

  if (successCount > 0) {
    console.log('\n🔑 Test credentials:');
    console.log('   E2E_MOTORISTA_EMAIL=motorista.test@rotamestre.tec.br');
    console.log('   E2E_MOTORISTA_PASSWORD=Test@123456');
    console.log('   E2E_GESTOR_EMAIL=gestor.test@rotamestre.tec.br');
    console.log('   E2E_GESTOR_PASSWORD=Test@123456');
  }
}

main().catch(console.error);
