# ResuLoto Platform

Monorepo Angular con dos aplicaciones independientes:

- `platform`: shell Capacitor, sin lógica de loterías. Centraliza capacidades nativas.
- `projects/resuloto`: microfrontend de resultados, cargado por Native Federation.

## Arquitectura

La shell expone un contrato de eventos versionado (`resuloto.native.request` / `resuloto.native.response`). Un MF solicita una capacidad (`barcode.scan`, `ads.banner`, `push.enable` o `share`) y la shell resuelve el plugin Capacitor correspondiente. De esta forma ningún MF importa Capacitor ni conoce detalles de iOS/Android.

La aplicación ResuLoto usa datos del servicio público `www2.resuloto.com`; cuando un servicio no responde, muestra datos de continuidad para mantener la experiencia navegable. Incluye últimos resultados, catálogo, históricos con carga progresiva, próximos botes, favoritos, comprobación manual, escáner nativo, compartir y notificaciones.

## Requisitos

- Node.js 20.19+ (se recomienda Node 24).
- Xcode para iOS y Android Studio para Android.

## Desarrollo web

```bash
npm install
npm run start:resuloto
# en otra terminal
npm run start:shell
```

Abre `http://localhost:4200`. La shell lee `public/federation.manifest.json`, que en desarrollo apunta a `http://localhost:4201/remoteEntry.json`.

Para ejecutar el MF aislado: `npm run start:resuloto` y abre `http://localhost:4201`.

## Compilación y apps nativas

```bash
npm run build:shell
npm run cap:add:ios
npm run cap:add:android
npm run cap:sync
npm run cap:open:ios
# o
npm run cap:open:android
```

El bundle id está fijado en `com.resuloto.resulotoApp`. Antes de producción, configura los IDs de AdMob en el proyecto nativo y publica el `remoteEntry.json` del MF en una URL HTTPS; actualiza entonces `public/federation.manifest.json` o proporciona el manifiesto remoto desde la infraestructura de la shell.

## Decisiones de integración

- Angular 21.2 + Native Federation 21.2: la línea estable con soporte directo del adaptador de Native Federation. Angular 22 requiere actualmente el adaptador v4 aún en transición.
- PrimeNG 21 con tema Aura.
- Capacitor 8 para Web, Android e iOS.
- La shell aplica el reset global de viewport, `app-root` y safe areas. Así el MF no cambia de ancho, márgenes o tipografía al ejecutarse dentro del WebView.
