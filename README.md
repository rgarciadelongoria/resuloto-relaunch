# ResuLoto Platform

Nueva implementación de ResuLoto como shell Capacitor genérica + microfrontend Angular federado. El código está en [`platform/`](platform/README.md).

```bash
cd platform
npm install
npm run start:resuloto # puerto 4201
npm run start:shell    # puerto 4200
```

Para iOS y Android: `npm run cap:add:ios`, `npm run cap:add:android` y `npm run cap:sync`. El bundle id es `com.resuloto.resulotoApp`. Consulta el [README de la plataforma](platform/README.md) para el contrato shell↔MF, publicación y ejecución nativa.
