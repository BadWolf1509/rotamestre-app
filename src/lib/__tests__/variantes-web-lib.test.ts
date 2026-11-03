import { readdirSync } from 'fs';
import { join } from 'path';

describe('variantes .web de src/lib', () => {
  it('as variantes .web de src/lib são só as que têm motivo de plataforma', () => {
    const web = readdirSync(join(__dirname, '..'))
      .filter((f) => /\.web\.tsx?$/.test(f))
      .sort();
    // google.web.ts divergiu de google.ts (B1) e o Jest nunca o carregava.
    expect(web).toEqual(['navigation.web.ts', 'supabase.web.ts']);
  });
});
