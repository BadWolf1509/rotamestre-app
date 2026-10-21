/**
 * Guarda do R8 no build release Android: o aviso de ofuscação da Play some só
 * com minificação ligada, e o `shrinkResources` só vale junto dela.
 * Plano: docs/superpowers/plans/2026-10-20-ativar-r8-android.md
 */

type PluginEntry = string | [string, Record<string, unknown>];

interface BuildPropertiesOptions {
  android?: {
    enableMinifyInReleaseBuilds?: boolean;
    enableShrinkResourcesInReleaseBuilds?: boolean;
    enableBundleCompression?: boolean;
    extraProguardRules?: string;
  };
}

const appConfig = require('../../../app.config.js') as (ctx: {
  config: object;
}) => {
  plugins: PluginEntry[];
};

function opcoesBuildProperties(): BuildPropertiesOptions | undefined {
  const entrada = appConfig({ config: {} }).plugins.find(
    (p): p is [string, Record<string, unknown>] =>
      Array.isArray(p) && p[0] === 'expo-build-properties',
  );
  return entrada?.[1] as BuildPropertiesOptions | undefined;
}

describe('app.config.js — R8 no release Android', () => {
  it('declara o plugin expo-build-properties com opções', () => {
    expect(opcoesBuildProperties()).toBeDefined();
  });

  it('liga a minificação (R8) no release', () => {
    expect(opcoesBuildProperties()?.android?.enableMinifyInReleaseBuilds).toBe(
      true,
    );
  });

  it('liga o shrinkResources junto da minificação', () => {
    expect(
      opcoesBuildProperties()?.android?.enableShrinkResourcesInReleaseBuilds,
    ).toBe(true);
  });

  // O AppLoaderProvider (expo-modules-core) instancia o RNHeadlessAppLoader por
  // Class.forName a partir de um meta-data do manifest, e o R8 removia a classe:
  // job de localização em segundo plano → NPE em TaskService.executeTask, crash
  // em loop (moto g15, 21/10/2026).
  it('mantém o carregador headless que o expo-modules-core acha por reflexão', () => {
    const regras = opcoesBuildProperties()?.android?.extraProguardRules ?? '';
    expect(regras).toContain(
      '-keep class * implements expo.modules.apploader.HeadlessAppLoader { <init>(); }',
    );
  });

  it('não liga a compressão do bundle, que não é R8 e atrasa a partida', () => {
    expect(opcoesBuildProperties()?.android?.enableBundleCompression).not.toBe(
      true,
    );
  });
});
