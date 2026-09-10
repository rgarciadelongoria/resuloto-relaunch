import { Injectable, NgZone } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner';
import { PushNotifications } from '@capacitor/push-notifications';
import { Share } from '@capacitor/share';
import { AdMob } from '@capacitor-community/admob';
import { NATIVE_REQUEST_EVENT, NATIVE_RESPONSE_EVENT, NativeRequest, NativeResponse } from './native-contract';

@Injectable({ providedIn: 'root' })
export class NativeCapabilityHostService {
  constructor(private readonly zone: NgZone) {}

  start(): void {
    window.addEventListener(NATIVE_REQUEST_EVENT, this.handleRequest as EventListener);
  }

  stop(): void {
    window.removeEventListener(NATIVE_REQUEST_EVENT, this.handleRequest as EventListener);
  }

  private handleRequest = (event: CustomEvent<NativeRequest>): void => {
    void this.zone.run(() => this.resolve(event.detail));
  };

  private async resolve(request: NativeRequest): Promise<void> {
    try {
      const value = await this.execute(request);
      this.respond({ id: request.id, ok: true, value });
    } catch (cause) {
      this.respond({
        id: request.id,
        ok: false,
        error: { code: 'NATIVE_CAPABILITY_FAILED', message: cause instanceof Error ? cause.message : 'Native capability failed' },
      });
    }
  }

  private async execute(request: NativeRequest): Promise<unknown> {
    const native = Capacitor.isNativePlatform();
    switch (request.capability) {
      case 'barcode.scan': {
        if (!native) throw new Error('El escáner está disponible en la app móvil.');
        const result = await CapacitorBarcodeScanner.scanBarcode({
          hint: CapacitorBarcodeScannerTypeHint.ALL,
          scanInstructions: 'Enfoca el código del boleto dentro del recuadro.',
        });
        return { content: result.ScanResult ?? '' };
      }
      case 'push.enable': {
        if (!native) return { enabled: false, reason: 'web' };
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive === 'granted') await PushNotifications.register();
        return { enabled: permission.receive === 'granted' };
      }
      case 'share': {
        const payload = request.payload as { title?: string; text?: string; url?: string } | undefined;
        await Share.share(payload ?? {});
        return { shared: true };
      }
      case 'ads.banner': {
        if (!native) return { visible: false, reason: 'web' };
        const payload = request.payload as { action?: 'show' | 'hide'; options?: Record<string, unknown> } | undefined;
        if (payload?.action === 'hide') {
          await AdMob.hideBanner();
          return { visible: false };
        }
        // The concrete ad unit is injected by the native build configuration.
        await AdMob.showBanner(payload?.options as never);
        return { visible: true };
      }
    }
  }

  private respond(response: NativeResponse): void {
    window.dispatchEvent(new CustomEvent<NativeResponse>(NATIVE_RESPONSE_EVENT, { detail: response }));
  }
}
