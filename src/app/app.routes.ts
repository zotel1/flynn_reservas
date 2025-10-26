import { Routes } from '@angular/router';
import { Reservas } from './pages/reservas/reservas';

export const routes: Routes = [
  { path: '', component: Reservas },
  { path: '**', redirectTo: '' },
];
