import * as DesktopIndex from '../desktop';
import * as MobileIndex from '../mobile';

describe('component index exports', () => {
  it('exposes desktop components', () => {
    expect(DesktopIndex).toBeTruthy();
  });

  it('exposes mobile components', () => {
    expect(MobileIndex).toBeTruthy();
  });
});
