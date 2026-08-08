/* global Buffer, fetch, URLSearchParams */
/**
 * Cliente mínimo da Google Play Developer API v3.
 *
 * Sem dependências: JWT RS256 assinado com `node:crypto` e trocado por access
 * token no escopo `androidpublisher`. É o mesmo esquema que
 * `scripts/publish-play-listing.mjs` já usava — aquele script mantém a própria
 * cópia de propósito, para não arriscar um caminho de publicação que funciona;
 * unificar os dois é follow-up.
 *
 * A credencial nunca é logada nem versionada: `play-store-credentials.json` é
 * gitignored (ver docs/GOOGLE_PLAY_DEPLOYMENT.md).
 */
import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

export const PACKAGE_NAME = 'br.tec.rotamestre.app';
export const API_BASE =
  'https://androidpublisher.googleapis.com/androidpublisher/v3';

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replaceAll('=', '')
    .replaceAll('+', '-')
    .replaceAll('/', '_');
}

export async function loadCredentials() {
  const file =
    process.env.PLAY_CREDENTIALS_PATH ??
    path.join(process.cwd(), 'play-store-credentials.json');
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    throw new Error(
      `Credencial da Play não encontrada em ${file}. ` +
        'Defina PLAY_CREDENTIALS_PATH ou rode a partir da raiz do repositório.',
    );
  }
}

export async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: credentials.token_uri ?? 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer
    .sign(credentials.private_key, 'base64')
    .replaceAll('=', '')
    .replaceAll('+', '-')
    .replaceAll('/', '_');

  const response = await fetch(
    credentials.token_uri ?? 'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${unsigned}.${signature}`,
      }),
    },
  );
  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error(`Falha ao autenticar na Play API (${response.status})`);
  }
  return body.access_token;
}

export async function api(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 800);
    throw new Error(`Play API ${response.status}: ${detail}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Executa `fn` dentro de um edit da Play.
 *
 * Um edit é obrigatório mesmo para leitura. Quando `commit` é false, o edit é
 * descartado no fim — nada é publicado.
 */
export async function withEdit(token, fn, { commit = false } = {}) {
  const edit = await api(
    token,
    `${API_BASE}/applications/${PACKAGE_NAME}/edits`,
    {
      method: 'POST',
    },
  );
  const base = `${API_BASE}/applications/${PACKAGE_NAME}/edits/${edit.id}`;
  try {
    const result = await fn(edit.id, base);
    if (commit) {
      await api(token, `${base}:commit`, { method: 'POST' });
    } else {
      await api(token, base, { method: 'DELETE' });
    }
    return result;
  } catch (error) {
    // Edit abandonado não bloqueia os próximos; ignorar falha de limpeza é
    // deliberado para não mascarar o erro original.
    await api(token, base, { method: 'DELETE' }).catch(() => {});
    throw error;
  }
}
