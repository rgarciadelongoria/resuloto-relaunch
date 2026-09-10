import { initFederation } from '@angular-architects/native-federation';

// Al ejecutarse de forma autónoma, el remote necesita registrar el import-map
// que Native Federation genera para Angular. Dentro de la shell ya estará
// registrado, por lo que esta inicialización es idempotente.
initFederation()
  .catch(error => console.error('No se ha podido inicializar la federación', error))
  .then(() => import('./bootstrap'))
  .catch(error => console.error('No se ha podido iniciar Resuloto', error));
