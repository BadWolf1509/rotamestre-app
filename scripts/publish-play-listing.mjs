/* global Buffer, console, fetch, URLSearchParams */

import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const packageName = 'br.tec.rotamestre.app';
const language = 'pt-BR';
const apiBase = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const uploadBase =
  'https://androidpublisher.googleapis.com/upload/androidpublisher/v3';

const listing = {
  title: 'Rota Mestre',
  shortDescription:
    'Planeje entregas, organize paradas e acompanhe rotas em tempo real.',
  fullDescription: `O Rota Mestre ajuda empresas e equipes de entrega a planejar, executar e acompanhar rotas em um só lugar.

PARA GESTORES
• Crie rotas com múltiplas paradas
• Organize a ordem das entregas
• Atribua rotas aos motoristas
• Acompanhe o progresso de rotas ativas
• Consulte histórico, ocorrências e comprovantes
• Gerencie motoristas e unidades

PARA MOTORISTAS
• Receba no celular as rotas atribuídas
• Use navegação durante as entregas
• Consulte paradas e detalhes do destino
• Registre entregas, retiradas e ocorrências
• Envie fotos de comprovação
• Mantenha o gestor informado durante a rota

LOCALIZAÇÃO DURANTE A ROTA
Quando o motorista inicia uma rota, o aplicativo pode usar a localização em segundo plano para manter a navegação e permitir o acompanhamento operacional pelo gestor. O rastreamento é interrompido quando a rota é pausada ou encerrada.

O Rota Mestre possui interface em português e foi desenvolvido para operações logísticas de empresas brasileiras.

Suporte: contato@rotamestre.tec.br`,
};

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replaceAll('=', '')
    .replaceAll('+', '-')
    .replaceAll('/', '_');
}

async function getAccessToken(credentials) {
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
    throw new Error(
      `Falha ao autenticar na API do Google Play (${response.status})`,
    );
  }
  return body.access_token;
}

async function apiRequest(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1200);
    throw new Error(
      `Google Play API ${response.status} ${response.statusText}: ${detail}`,
    );
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function replaceImages(token, editId, imageType, filePaths) {
  const root = `${packageName}/edits/${editId}/listings/${language}/${imageType}`;
  await apiRequest(token, `${apiBase}/applications/${root}`, {
    method: 'DELETE',
  });
  for (const filePath of filePaths) {
    const bytes = await readFile(filePath);
    await apiRequest(
      token,
      `${uploadBase}/applications/${root}?uploadType=media`,
      {
        method: 'POST',
        headers: { 'content-type': 'image/png' },
        body: bytes,
      },
    );
  }
}

async function main() {
  const workspace = process.cwd();
  const credentials = JSON.parse(
    await readFile(path.join(workspace, 'play-store-credentials.json'), 'utf8'),
  );
  const token = await getAccessToken(credentials);
  const edit = await apiRequest(
    token,
    `${apiBase}/applications/${packageName}/edits`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    },
  );

  await apiRequest(
    token,
    `${apiBase}/applications/${packageName}/edits/${edit.id}/listings/${language}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(listing),
    },
  );
  await replaceImages(token, edit.id, 'icon', [
    path.join(workspace, 'assets', 'store', 'icon-512.png'),
  ]);
  await replaceImages(token, edit.id, 'featureGraphic', [
    path.join(workspace, 'assets', 'store', 'feature-graphic-1024x500-v2.png'),
  ]);
  // Os 8 de `final/` são a fonte de verdade declarada em
  // docs/play-store-metadata.md e o que está publicado hoje. As 4 capturas
  // antigas na raiz de `phone/` ficaram para trás — rodar este script com elas
  // sobrescreveria a listagem com screenshots desatualizados.
  const screenshots = [
    '01-gestao-em-um-so-lugar.png',
    '02-crie-rotas-em-poucos-passos.png',
    '03-acompanhe-a-operacao.png',
    '04-mapa-e-paradas.png',
    '05-proxima-parada-a-vista.png',
    '06-todas-as-paradas-no-mapa.png',
    '07-navegue-com-seu-app-favorito.png',
    '08-ajuda-sempre-a-mao.png',
  ].map((fileName) =>
    path.join(
      workspace,
      'assets',
      'store',
      'screenshots',
      'phone',
      'final',
      fileName,
    ),
  );
  await replaceImages(token, edit.id, 'phoneScreenshots', screenshots);
  await replaceImages(token, edit.id, 'sevenInchScreenshots', screenshots);
  await replaceImages(token, edit.id, 'tenInchScreenshots', screenshots);
  await apiRequest(
    token,
    `${apiBase}/applications/${packageName}/edits/${edit.id}:commit`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    },
  );
  console.log(
    'Listagem pt-BR, ícone, recurso gráfico e capturas enviados com sucesso.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
