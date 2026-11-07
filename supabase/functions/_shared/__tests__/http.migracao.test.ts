// Funções já migradas para _shared/http.ts não voltam a declarar CORS próprio
// nem montar Response JSON na mão. As que ainda não migraram (delete-account,
// send-push-notification, expire-routes, remind-routes) ficam fora da lista.
import { readFileSync } from 'fs';
import { join } from 'path';

const migradas = [
  'google-place-details',
  'google-places-autocomplete',
  'criar-motorista',
];

describe.each(migradas)('%s: usa _shared/http.ts', (nome) => {
  const fonte = readFileSync(
    join(__dirname, '..', '..', nome, 'index.ts'),
    'utf8',
  );

  it('importa de ../_shared/http.ts', () => {
    expect(fonte).toMatch(/from\s*'\.\.\/_shared\/http\.ts'/);
  });

  it('não declara corsHeaders próprio nem monta new Response com JSON', () => {
    expect(fonte).not.toMatch(/const corsHeaders\s*=/);
    expect(fonte).not.toMatch(/new Response\(\s*JSON\.stringify/);
  });
});
