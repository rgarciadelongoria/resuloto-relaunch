const { withNativeFederation, shareAll } = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({
  name: 'resuloto',

  exposes: {
    './Component': './projects/resuloto/src/app/app.ts',
  },

  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    '@capacitor/core',
    '@capacitor/android',
    '@capacitor/ios',
    '@capacitor/barcode-scanner',
    '@capacitor/push-notifications',
    '@capacitor/share',
    '@capacitor-community/admob',
    'primeng',
    '@primeng/themes',
    // Add further packages you don't need at runtime
  ],

  // Please read our FAQ about sharing libs:
  // https://shorturl.at/jmzH0

  features: {
    // New feature for more performance and avoiding
    // issues with node libs. Comment this out to
    // get the traditional behavior:
    ignoreUnusedDeps: true,
  },
});
