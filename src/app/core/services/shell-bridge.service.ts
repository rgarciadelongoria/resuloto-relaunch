import { Injectable } from '@angular/core';
import { AdvertisingConfig } from '../models/resuloto.models';

/** Contrato fino con resuloto-shell: el remote no importa Capacitor ni plugins nativos. */
@Injectable({ providedIn: 'root' })
export class ShellBridgeService {
  private requestSequence = 0;
  private scannerCancel?: HTMLButtonElement;

  get platform(): string {
    try {
      return localStorage.getItem('shellPlatform') ?? 'web';
    } catch {
      return 'web';
    }
  }

  get isNative(): boolean {
    return this.platform === 'android' || this.platform === 'ios';
  }

  applyChrome(): void {
    if (!this.isNative) return;
    document.documentElement.classList.add('resuloto-native');
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.width = '100%';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.width = '100%';
    this.dispatch('shellStatusbarSetStyle', { style: 'DARK' });
    this.dispatch('shellStatusbarSetBackgroundColor', { color: '#0b162e' });
  }

  trackScreen(name: string): void {
    this.dispatch('shellAnalyticsSetCurrentScreen', {
      currentScreenOptions: { screenName: name, screenClassOverride: 'resuloto-remote' }
    });
  }

  track(name: string, params: Record<string, string | number> = {}): void {
    this.dispatch('shellAnalyticsLogEvent', { logEventOptions: { name, params } });
  }

  vibrate(duration = 18): void {
    if (this.isNative) this.dispatch('shellVibration', { duration });
  }

  async scanCode(): Promise<string> {
    if (!this.isNative) {
      throw new Error('El escáner está disponible desde la aplicación móvil.');
    }

    document.body.classList.add('barcode-scanner-active');
    await this.hideBanner();
    document.documentElement.classList.add('barcode-scanner-active');
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    const root = document.querySelector<HTMLElement>('rl-root');
    root?.classList.add('scanner-host-hidden');
    root?.style.setProperty('visibility', 'hidden', 'important');
    root?.style.setProperty('pointer-events', 'none', 'important');
    this.scannerCancel = document.createElement('button');
    this.scannerCancel.type = 'button';
    this.scannerCancel.textContent = 'Cancelar';
    this.scannerCancel.setAttribute('aria-label', 'Cerrar cámara');
    Object.assign(this.scannerCancel.style, { position: 'fixed', bottom: 'calc(24px + env(safe-area-inset-bottom))', right: '20px', zIndex: '2147483647', padding: '12px 18px', border: '1px solid rgba(255,255,255,.6)', borderRadius: '12px', background: 'rgba(15,20,35,.86)', color: '#fff', font: '700 14px -apple-system, sans-serif' });
    this.scannerCancel.addEventListener('click', () => void this.stopScan(), { once: true });
    document.body.appendChild(this.scannerCancel);
    const response = await this.request<unknown>('shellScannerStart', {}, 'shellScannerError', 45_000);
    const scanned = response as Record<string, unknown>;
    const code = [scanned?.['rawValue'], scanned?.['displayValue'], scanned?.['text'], scanned?.['value']]
      .find((value): value is string => typeof value === 'string' && value.length > 0);

    if (!code) throw new Error('No se ha podido leer el código. Inténtalo de nuevo o usa el comprobador manual.');
    return code;
  }

  async stopScan(): Promise<void> {
    document.body.classList.remove('barcode-scanner-active');
    document.documentElement.classList.remove('barcode-scanner-active');
    document.documentElement.style.removeProperty('background');
    document.body.style.removeProperty('background');
    const root = document.querySelector<HTMLElement>('rl-root');
    root?.classList.remove('scanner-host-hidden');
    root?.style.removeProperty('visibility');
    root?.style.removeProperty('pointer-events');
    this.scannerCancel?.remove();
    this.scannerCancel = undefined;
    await this.resumeBanner();
    if (!this.isNative) return;
    try { await this.request('shellScannerStop', {}, undefined, 5_000); } catch { /* ya estaba cerrado */ }
  }

  async hideBanner(): Promise<void> {
    if (this.isNative) { try { await this.request('shellAdmobHideBanner', {}, undefined, 5_000); } catch {} }
  }

  async resumeBanner(): Promise<void> {
    if (this.isNative) { try { await this.request('shellAdmobResumeBanner', {}, undefined, 5_000); } catch {} }
  }

  async openExternal(url: string): Promise<void> {
    if (!this.isNative) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    await this.request('shellBrowserOpen', { url }, undefined, 8_000);
  }

  async initializeAds(config?: AdvertisingConfig): Promise<void> {
    if (!this.isNative || !config?.mostrarBannerAdmob) return;
    try {
      await this.request('shellAdmobInitializeFull', { initializeForTesting: false }, undefined, 10_000);
      const adId = this.platform === 'ios' ? config.ios_idBanner : config.android_idBanner;
      if (!adId) return;
      await this.request('shellAdmobShowBanner', {
        bannerAdOptions: { adId, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: false }
      }, undefined, 10_000);
    } catch {
      // Un fallo de monetización no debe impedir consultar resultados.
    }
  }

  async showInterstitial(config?: AdvertisingConfig): Promise<void> {
    if (!this.isNative || !config?.mostrarIntersticialAdmob) return;
    const adId = this.platform === 'ios' ? config.ios_idInterstitial : config.android_idInterstitial;
    if (!adId) return;
    try {
      await this.request('shellAdmobShowInterstitial', { interstitialAdOptions: { adId, isTesting: false } }, undefined, 12_000);
    } catch {
      // Silencioso: los anuncios son complementarios a la tarea principal.
    }
  }

  private dispatch(event: string, detail: Record<string, unknown>): void {
    window.dispatchEvent(new CustomEvent(event, { detail }));
  }

  private request<T>(
    event: string,
    detail: Record<string, unknown>,
    errorEvent?: string,
    timeout = 7_000
  ): Promise<T> {
    const responseEvent = `resuloto:${event}:${Date.now()}:${++this.requestSequence}`;

    return new Promise<T>((resolve, reject) => {
      const cleanup = () => {
        window.removeEventListener(responseEvent, onResponse);
        if (errorEvent) window.removeEventListener(errorEvent, onError);
        clearTimeout(timer);
      };
      const onResponse = (eventResponse: Event) => {
        cleanup();
        const custom = eventResponse as CustomEvent<{ response?: T }>;
        resolve(custom.detail?.response as T);
      };
      const onError = (eventError: Event) => {
        cleanup();
        const custom = eventError as CustomEvent<{ response?: unknown }>;
        const message = custom.detail?.response instanceof Error
          ? custom.detail.response.message
          : 'El dispositivo no ha podido completar la acción.';
        reject(new Error(message));
      };
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error('La función nativa no ha respondido.'));
      }, timeout);

      window.addEventListener(responseEvent, onResponse, { once: true });
      if (errorEvent) window.addEventListener(errorEvent, onError, { once: true });
      this.dispatch(event, { ...detail, responseEvent });
    });
  }
}
