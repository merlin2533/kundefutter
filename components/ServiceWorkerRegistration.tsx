'use client';
import { useEffect } from 'react';

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'v1';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(`/sw.js?v=${BUILD_ID}`).catch(() => {});
    }
  }, []);
  return null;
}
