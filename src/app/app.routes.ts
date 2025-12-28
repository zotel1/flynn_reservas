import { Routes } from '@angular/router';
import { Reservas } from './pages/reservas/reservas';
import { Chatbot } from './components/chatbot/chatbot';
import { ReservasDashboard } from './components/reservas-dashboard/reservas-dashboard';
import { PoliticaPrivacidadComponent } from './pages/politica-privacidad/politica-privacidad';
import { TerminosServicioComponent } from './pages/terminos-servicio/terminos-servicio';

export const routes: Routes = [
  { path: '', component: Chatbot },
  { path: 'reservas', component: Reservas },
  {  path: 'admin/reservas', component: ReservasDashboard  },
  { path: 'politica-privacidad', component: PoliticaPrivacidadComponent },
  { path: 'terminos-servicio', component: TerminosServicioComponent },
  { path: '**', redirectTo: '' }
];
