import { ICON_MAP } from '../Dialog.types';
import { getIconName } from '../DialogIcon';

describe('getIconName', () => {
  it("'danger' sem ícone próprio continua sendo a lixeira (excluir)", () => {
    expect(getIconName('confirm', 'danger')).toBe(ICON_MAP.danger);
    expect(ICON_MAP.danger).toBe('trash-outline');
  });

  it('o ícone passado pelo chamador vence o do tipo', () => {
    expect(getIconName('confirm', 'danger', 'log-out-outline')).toBe(
      'log-out-outline',
    );
    expect(getIconName('alert', 'error', 'log-out-outline')).toBe(
      'log-out-outline',
    );
  });
});
