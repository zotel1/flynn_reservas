import { Routes } from '@angular/router';
import { Reservas } from './pages/reservas/reservas';
import { Chatbot } from './components/chatbot/chatbot';
import { ReservasDashboard } from './components/reservas-dashboard/reservas-dashboard';

export const routes: Routes = [
  { path: '', component: Chatbot },
  { path: '/reservas', component: Reservas },
  {  path: 'admin/reservas', component: ReservasDashboard  },
  { path: '**', redirectTo: '' }
];
