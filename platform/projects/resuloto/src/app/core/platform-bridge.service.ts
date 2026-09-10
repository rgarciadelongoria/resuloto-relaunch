import { Injectable } from '@angular/core';

interface BridgeResponse<T> {
  id: string;
  ok: boolean;
  value?: T;
  error?: { message: string };
}

@Injectable({ providedIn: 'root' })
export class PlatformBridgeService {
  private readonly requestEvent = 'resuloto.native.request';
  private readonly responseEvent = 'resuloto.native.response';

  request<T>(capability: 'barcode.scan' | 'ads.banner' | 'push.enable' | 'share', payload?: unknown): Promise<T> {
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        window.removeEventListener(this.responseEvent, onResponse);
        reject(new Error('La shell no respondió a la capacidad solicitada.'));
      }, 12_000);
      const onResponse = (event: Event) => {
        const response = (event as CustomEvent<BridgeResponse<T>>).detail;
        if (response.id !== id) return;
        clearTimeout(timeout);
        window.removeEventListener(this.responseEvent, onResponse);
        response.ok ? resolve(response.value as T) : reject(new Error(response.error?.message ?? 'Operación no disponible'));
      };
      window.addEventListener(this.responseEvent, onResponse);
      window.dispatchEvent(new CustomEvent(this.requestEvent, { detail: { id, capability, payload } }));
    });
  }
}
