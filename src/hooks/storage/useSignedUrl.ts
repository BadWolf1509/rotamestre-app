import { useEffect, useState } from 'react';

import { createSignedUrlForFoto, getStoragePath } from '@/lib/storage';

interface SignedUrlState {
  url: string | null;
  loading: boolean;
  error: boolean;
}

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const DEFAULT_EXPIRES_IN = 3600;
const REFRESH_MARGIN_MS = 60_000;

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string | null>>();

function getFresh(path: string): string | null {
  const entry = cache.get(path);
  if (entry && entry.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return entry.url;
  }
  return null;
}

async function resolvePath(
  path: string,
  expiresIn: number,
): Promise<string | null> {
  const fresh = getFresh(path);
  if (fresh) return fresh;
  const existing = inFlight.get(path);
  if (existing) return existing;
  const promise = createSignedUrlForFoto(path, expiresIn)
    .then((url) => {
      if (url) {
        cache.set(path, { url, expiresAt: Date.now() + expiresIn * 1000 });
      }
      return url;
    })
    .finally(() => {
      inFlight.delete(path);
    });
  inFlight.set(path, promise);
  return promise;
}

/**
 * Resolve um foto_url (URL legada ou path) para um signed URL renderizável.
 * Pass-through de URLs http externas; null para valor inválido.
 */
export function useSignedUrl(
  value: string | null | undefined,
  options?: { expiresIn?: number },
): SignedUrlState {
  const expiresIn = options?.expiresIn ?? DEFAULT_EXPIRES_IN;
  const path = getStoragePath(value);
  const passthrough =
    !path && typeof value === 'string' && /^https?:\/\//i.test(value);

  const [url, setUrl] = useState<string | null>(() => {
    if (passthrough) return value as string;
    return path ? getFresh(path) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (passthrough) {
      setUrl(value as string);
      setLoading(false);
      setError(false);
      return;
    }
    if (!path) {
      setUrl(null);
      setLoading(false);
      setError(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(false);
    resolvePath(path, expiresIn).then((resolved) => {
      if (!active) return;
      setUrl(resolved);
      setError(resolved === null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [path, passthrough, value, expiresIn]);

  return { url, loading, error };
}
