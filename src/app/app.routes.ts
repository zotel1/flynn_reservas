import { Routes } from '@angular/router';
import { Reservas } from './pages/reservas/reservas';
import { Chatbot } from './components/chatbot/chatbot';

export const routes: Routes = [
  { path: '', component: Chatbot },
  { path: 'reservas', component: Reservas },
  { path: '**', redirectTo: '' },
  
];
