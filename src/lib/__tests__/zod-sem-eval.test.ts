import { z } from 'zod';

import '../zodSemEval';

describe('zodSemEval', () => {
  it('liga o modo jitless do zod', () => {
    expect(z.core.globalConfig.jitless).toBe(true);
  });

  it('valida sem chamar new Function', () => {
    const original = global.Function;
    const espiao = jest.fn(() => {
      throw new Error('eval proibido');
    });
    // @ts-expect-error substitui o construtor só durante o teste
    global.Function = espiao;
    try {
      const schema = z.object({ email: z.string().email(), n: z.number() });
      expect(schema.safeParse({ email: 'a@b.co', n: 1 }).success).toBe(true);
      expect(schema.safeParse({ email: 'x', n: 1 }).success).toBe(false);
    } finally {
      global.Function = original;
    }
    expect(espiao).not.toHaveBeenCalled();
  });
});
