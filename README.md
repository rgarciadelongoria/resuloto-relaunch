# Resuloto relaunch

Microfrontal Angular 17 independiente, preparado para ser cargado por `resuloto-shell` mediante Native Federation. Expone `./routes`, no incorpora Capacitor y usa la shell como única puerta a hardware, analítica, publicidad y navegador nativo.

## Qué se ha rediseñado

- Inicio orientado a consulta rápida: resultados recientes, números legibles, extras y acceso directo al comprobador.
- Catálogo con búsqueda, países, organismos y favoritos persistentes por país.
- Vista de histórico por juego, con acceso al vídeo del sorteo cuando la fuente lo ofrece.
- Comprobación manual para los juegos cuyo catálogo publica endpoint propio (Lotería Nacional y los juegos ONCE) y enlace seguro al comprobador especializado para Bonoloto, Primitiva y EuroMillones.
- Escaneo de boleto únicamente a través de `shellScannerStart`; la app web no solicita ni implementa cámara propia.
- Integración no intrusiva con AdMob, haptics, StatusBar, Browser y Firebase Analytics mediante eventos `CustomEvent` de la shell.

## Auditoría de la aplicación anterior

La versión `v1.0.7` carga su catálogo desde `json/getJson.php`, resultados XML desde `servicios-v2/axml/` y comprobaciones desde `servicios-v2/php/`. Sus endpoints públicos permiten CORS (`Access-Control-Allow-Origin: *`). Este proyecto conserva esos datos, pero no ejecuta el JavaScript ni inyecta el HTML/XML de configuración de la app anterior: los adapta a modelos tipados y sólo pinta texto extraído de forma segura.

Las rutas de datos principales son:

- `v1.0.7/json/getJson.php?fichJson=config.json`
- `v1.0.7/json/getJson.php?fichJson=juegos-{pais}.json`
- `{carpetaXML}{urlXmlUltimosResultados}` y `{carpetaXML}{juego.urlXML}`
- `{carpetaPHP}appMovilProxyScan.php?qr={codigo}&pais={pais}`

## Desarrollo

La versión de Angular y Native Federation coincide con `resuloto-shell`.

```console
npm start
npm run build
```

El build genera [`remoteEntry.json`](./dist/resuloto-app/remoteEntry.json) y expone `./routes`. Para conectarlo a la shell, publica el contenido de `dist/resuloto-app` y actualiza el manifiesto de la shell:

```json
{
  "app": "https://tu-dominio/resuloto/remoteEntry.json"
}
```

Para desarrollo, Native Federation sirve el remote y la shell debe apuntar al `remoteEntry.json` indicado por la salida de `npm start`.

## Contrato con la shell

`ShellBridgeService` concentra todo el acoplamiento. Envía los eventos existentes en `resuloto-shell/src/app/enums/shell.enum.ts`:

| Capacidad | Eventos |
| --- | --- |
| Escáner QR/códigos | `shellScannerStart`, `shellScannerResponse`, `shellScannerError` |
| Navegador nativo | `shellBrowserOpen` |
| Analítica y hápticos | `shellAnalytics*`, `shellVibration` |
| Publicidad | `shellAdmobInitializeFull`, `shellAdmobShowBanner`, `shellAdmobShowInterstitial` |
| Barra de estado | `shellStatusbarSetStyle`, `shellStatusbarSetBackgroundColor` |

En escritorio el escáner no cae a una implementación de cámara diferente: muestra la alternativa manual. La publicidad sólo se inicializa si la shell informa plataforma `android` o `ios` en `localStorage.shellPlatform`.

## Estructura

```text
src/app/
├── core/models                 # Contratos de API y presentación
├── core/services
│   ├── resuloto-api.service.ts # Adaptador seguro de API/XML/PHP pública
│   ├── shell-bridge.service.ts # Puente de capacidades nativas
│   └── preferences.store.ts    # País y favoritos locales
├── pages/lotto-dashboard.*     # UI responsive y flujos de producto
└── app.routes.ts               # Expuesto como ./routes
```
