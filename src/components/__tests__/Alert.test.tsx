import { render } from '@testing-library/react-native';

import { Alert } from '../Alert';

describe('Alert accessibility', () => {
  it('action button has accessibilityLabel matching actionLabel', () => {
    const { getByLabelText } = render(
      <Alert
        message="Test"
        actionLabel="Confirmar"
        onAction={() => {}}
        onClose={() => {}}
      />,
    );
    expect(getByLabelText('Confirmar')).toBeTruthy();
  });

  it('close button has accessibilityLabel "Fechar alerta"', () => {
    const { getByLabelText } = render(
      <Alert message="Test" onClose={() => {}} />,
    );
    expect(getByLabelText('Fechar alerta')).toBeTruthy();
  });
});
