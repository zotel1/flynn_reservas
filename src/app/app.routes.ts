import { Routes } from '@angular/router';
import { Reservas } from './pages/reservas/reservas';
import { Chatbot } from './components/chatbot/chatbot';
import { ReservasDashboard } from './components/reservas-dashboard/reservas-dashboard';
import { PoliticaPrivacidad } from './pages/politica-privacidad/politica-privacidad';
import { TerminosServicio } from './pages/terminos-servicio/terminos-servicio';

export const routes: Routes = [
  { path: '', component: Chatbot },
  { path: 'reservas', component: Reservas },
  {  path: 'admin/reservas', component: ReservasDashboard  },
  { path: 'politica-privacidad', component: PoliticaPrivacidad },
  { path: 'terminos-servicio', component: TerminosServicio },
  { path: '**', redirectTo: '' }
];
