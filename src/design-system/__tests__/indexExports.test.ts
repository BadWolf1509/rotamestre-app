import * as designSystem from '@/design-system';

describe('design-system exports', () => {
  it('exposes core tokens', () => {
    expect(designSystem.defaultTheme).toBeDefined();
    expect(designSystem.colors).toBeDefined();
    expect(designSystem.spacing).toBeDefined();
    expect(designSystem.typography).toBeDefined();
  });

  it('exposes core components', () => {
    expect(designSystem.Button).toBeDefined();
    expect(designSystem.Card).toBeDefined();
    expect(designSystem.MobileCard).toBeDefined();
    expect(designSystem.DesktopCard).toBeDefined();
  });
});
