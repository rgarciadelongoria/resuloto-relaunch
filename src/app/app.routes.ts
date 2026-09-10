import { Routes } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { LottoDashboardComponent } from './pages/lotto-dashboard.component';
import { ResulotoApiService } from './core/services/resuloto-api.service';

export const routes: Routes = [
  // La shell sólo aporta Router; el remote registra su propio cliente HTTP en
  // este inyector de ruta para mantenerse desplegable de forma independiente.
  { path: '', component: LottoDashboardComponent, providers: [provideHttpClient(), ResulotoApiService] },
  { path: '**', redirectTo: '' }
];
