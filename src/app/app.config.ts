import { ApplicationConfig } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ResulotoApiService } from './core/services/resuloto-api.service';

export const appConfig: ApplicationConfig = {
  providers: [provideAnimations(), provideHttpClient(), ResulotoApiService, provideRouter(routes)]
};
