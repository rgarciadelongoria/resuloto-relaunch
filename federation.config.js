const { withNativeFederation, shareAll } = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({
  // Mantener el mismo identificador federado que usa la shell histórica.
  // El nombre del repositorio puede ser distinto; el runtime de federation no.
  name: 'resuloto',
  exposes: {
    './routes': './src/app/app.routes.ts'
  },
  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' })
  },
  skip: ['rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket']
});
