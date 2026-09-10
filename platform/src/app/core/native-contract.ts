/** A versioned, framework-agnostic contract used by every remote. */
export type NativeCapability = 'barcode.scan' | 'ads.banner' | 'push.enable' | 'share';

export interface NativeRequest<T = unknown> {
  id: string;
  capability: NativeCapability;
  payload?: T;
}

export interface NativeResponse<T = unknown> {
  id: string;
  ok: boolean;
  value?: T;
  error?: { code: string; message: string };
}

export const NATIVE_REQUEST_EVENT = 'resuloto.native.request';
export const NATIVE_RESPONSE_EVENT = 'resuloto.native.response';
