const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..', '..');
const THEME_PATH = path.join(ROOT, 'src', 'utils', 'styles.base.ts');
const OUTPUT_DIR = path.join(ROOT, 'tokens');
const OUTPUT_PLATFORM_DIR = path.join(OUTPUT_DIR, 'output');
const PUBLIC_CSS_DIR = path.join(ROOT, 'public', 'css');

function loadTsModule(filePath, baseRequire) {
  const source = fs.readFileSync(filePath, 'utf-8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
    },
  });

  const moduleExports = {};
  const sandbox = {
    exports: moduleExports,
    module: { exports: moduleExports },
    require: baseRequire,
  };
  vm.runInNewContext(outputText, sandbox, { filename: filePath });
  return sandbox.module.exports;
}

// Mock for react-native and related packages that contain Flow syntax
// These are not needed for token extraction - we only need the theme values
const REACT_NATIVE_MOCK = {
  Platform: { OS: 'web', select: (obj) => obj.default || obj.web || obj.ios },
  StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
  PixelRatio: { get: () => 2, roundToNearestPixel: (v) => v },
};

function loadThemes() {
  const themeRequire = createRequire(THEME_PATH);
  const sandboxRequire = (modulePath) => {
    // Handle path alias @/utils/color and relative ./color
    if (modulePath === './color' || modulePath === '@/utils/color') {
      const colorPath = path.join(path.dirname(THEME_PATH), 'color.ts');
      return loadTsModule(colorPath, themeRequire);
    }
    // Mock react-native and related packages to avoid Flow syntax errors
    if (modulePath === 'react-native' || modulePath.startsWith('react-native/')) {
      return REACT_NATIVE_MOCK;
    }
    if (modulePath === 'react-native-unistyles') {
      return { createStyleSheet: (fn) => fn, useStyles: () => ({}) };
    }
    return themeRequire(modulePath);
  };

  const moduleExports = loadTsModule(THEME_PATH, sandboxRequire);
  const directExports = moduleExports || {};
  return {
    defaultTheme: moduleExports.defaultTheme || directExports.defaultTheme,
    darkTheme: moduleExports.darkTheme || directExports.darkTheme,
  };
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function flatten(obj, prefix = []) {
  const entries = [];
  Object.entries(obj).forEach(([key, value]) => {
    const next = [...prefix, key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      entries.push(...flatten(value, next));
    } else {
      entries.push([next.join('.'), value]);
    }
  });
  return entries;
}

function toKebab(input) {
  return input
    .replace(/\./g, '-')
    .replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
    .replace(/--+/g, '-');
}

function buildOutputs(theme) {
  const core = {
    colors: theme.colors,
    spacing: theme.spacing,
    typography: theme.typography,
    radius: theme.borderRadius,
    shadows: theme.shadows,
    layout: theme.layout,
    desktop: theme.desktop,
    motion: theme.motion,
  };

  const semantic = {
    text: {
      primary: theme.colors.text,
      secondary: theme.colors.textSecondary,
      tertiary: theme.colors.textTertiary,
      inverse: theme.colors.textInverse,
    },
    surface: {
      background: theme.colors.background,
      surface: theme.colors.surface,
      card: theme.colors.card,
    },
    border: {
      default: theme.colors.border,
      divider: theme.colors.divider,
    },
    status: {
      success: theme.colors.success,
      successBg: theme.colors.successBg,
      warning: theme.colors.warning,
      warningBg: theme.colors.warningBg,
      warningText: theme.colors.warningText,
      error: theme.colors.error,
      errorBg: theme.colors.errorBg,
      info: theme.colors.info,
      infoBg: theme.colors.infoBg,
      muted: theme.colors.gray500,
    },
    incident: theme.colors.incident,
  };

  const components = {
    ...theme.components,
    dialog: theme.desktop.dialog,
  };

  return { core, semantic, components };
}

function buildCssVariables(tokens, selector = ':root') {
  const entries = [
    ...flatten(tokens.core.colors, ['color']),
    ...flatten(tokens.core.spacing, ['spacing']),
    ...flatten(tokens.core.radius, ['radius']),
    ...flatten(tokens.core.typography.fontSize, ['font', 'size']),
    ...flatten(tokens.core.desktop, ['desktop']),
    ...flatten(tokens.core.motion.duration, ['motion', 'duration']),
    ...flatten(tokens.core.motion.easing, ['motion', 'easing']),
  ];

  const lines = entries.map(([key, value]) => `  --${toKebab(key)}: ${value};`);
  return `${selector}\n{\n${lines.join('\n')}\n}\n`;
}

function buildAndroidColors(tokens) {
  const colorEntries = flatten(tokens.core.colors, ['color']);
  const lines = colorEntries
    .filter(([, value]) => typeof value === 'string' && value.startsWith('#'))
    .map(([key, value]) => `  <color name="${toKebab(key).replace(/-/g, '_')}">${value}</color>`);

  return `<resources>\n${lines.join('\n')}\n</resources>\n`;
}

function buildIosColors(tokens) {
  const colorEntries = flatten(tokens.core.colors, []);
  const colors = {};
  colorEntries.forEach(([key, value]) => {
    if (typeof value === 'string' && value.startsWith('#')) {
      colors[toKebab(key)] = value;
    }
  });
  return { colors };
}

function main() {
  const { defaultTheme, darkTheme } = loadThemes();
  if (!defaultTheme || !darkTheme) {
    throw new Error('Themes not found. Check src/utils/styles.base.ts');
  }

  const lightTokens = buildOutputs(defaultTheme);
  const darkTokens = buildOutputs(darkTheme);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_PLATFORM_DIR, { recursive: true });

  writeJson(path.join(OUTPUT_DIR, 'core.json'), lightTokens.core);
  writeJson(path.join(OUTPUT_DIR, 'semantic.json'), lightTokens.semantic);
  writeJson(path.join(OUTPUT_DIR, 'components.json'), lightTokens.components);
  writeJson(path.join(OUTPUT_DIR, 'dark', 'core.json'), darkTokens.core);
  writeJson(path.join(OUTPUT_DIR, 'dark', 'semantic.json'), darkTokens.semantic);
  writeJson(path.join(OUTPUT_DIR, 'dark', 'components.json'), darkTokens.components);

  // Build CSS content
  const lightCss = buildCssVariables(lightTokens);
  const darkCss = buildCssVariables(darkTokens, ':root[data-theme="dark"]');

  // Write to tokens/output/
  fs.writeFileSync(path.join(OUTPUT_PLATFORM_DIR, 'web.css'), lightCss, 'utf-8');
  fs.writeFileSync(path.join(OUTPUT_PLATFORM_DIR, 'web.dark.css'), darkCss, 'utf-8');

  // Also copy to public/css/ for web serving
  fs.mkdirSync(PUBLIC_CSS_DIR, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_CSS_DIR, 'tokens.css'), lightCss + '\n' + darkCss, 'utf-8');
  console.log('✅ CSS tokens written to public/css/tokens.css');

  fs.writeFileSync(path.join(OUTPUT_PLATFORM_DIR, 'android.xml'), buildAndroidColors(lightTokens), 'utf-8');
  fs.writeFileSync(path.join(OUTPUT_PLATFORM_DIR, 'android.dark.xml'), buildAndroidColors(darkTokens), 'utf-8');
  writeJson(path.join(OUTPUT_PLATFORM_DIR, 'ios.json'), buildIosColors(lightTokens));
  writeJson(path.join(OUTPUT_PLATFORM_DIR, 'ios.dark.json'), buildIosColors(darkTokens));
  writeJson(path.join(OUTPUT_PLATFORM_DIR, 'rn.json'), lightTokens);
  writeJson(path.join(OUTPUT_PLATFORM_DIR, 'rn.dark.json'), darkTokens);
}

main();
