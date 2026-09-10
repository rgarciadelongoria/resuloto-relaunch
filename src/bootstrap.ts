import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { LottoDashboardComponent } from './app/pages/lotto-dashboard.component';

bootstrapApplication(LottoDashboardComponent, appConfig)
  .catch(error => console.error('No se ha podido iniciar Resuloto', error));
