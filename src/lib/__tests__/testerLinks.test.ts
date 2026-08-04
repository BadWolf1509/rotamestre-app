describe('testerLinks', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('isRecruitmentEnabled é false sem o link de opt-in', () => {
    delete process.env.EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL;
    const { isRecruitmentEnabled } = require('../testerLinks');
    expect(isRecruitmentEnabled()).toBe(false);
  });

  it('isRecruitmentEnabled é true com o link de opt-in', () => {
    process.env.EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL =
      'https://play.google.com/apps/testing/br.tec.rotamestre.app';
    const { isRecruitmentEnabled } = require('../testerLinks');
    expect(isRecruitmentEnabled()).toBe(true);
  });

  it('getTesterLinks usa o default da Play Store quando a env não está definida', () => {
    delete process.env.EXPO_PUBLIC_PLAY_STORE_URL;
    const { getTesterLinks } = require('../testerLinks');
    expect(getTesterLinks().storeUrl).toBe(
      'https://play.google.com/store/apps/details?id=br.tec.rotamestre.app',
    );
  });

  it('getTesterLinks reflete as envs definidas', () => {
    process.env.EXPO_PUBLIC_PLAY_TESTING_OPTIN_URL = 'https://optin.example';
    process.env.EXPO_PUBLIC_PLAY_TESTER_GROUP_URL = 'https://group.example';
    process.env.EXPO_PUBLIC_PLAY_STORE_URL = 'https://store.example';
    const { getTesterLinks } = require('../testerLinks');
    expect(getTesterLinks()).toEqual({
      optInUrl: 'https://optin.example',
      groupUrl: 'https://group.example',
      storeUrl: 'https://store.example',
    });
  });
});
