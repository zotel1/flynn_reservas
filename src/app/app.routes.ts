import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { Reservas } from './pages/reservas/reservas';

const routes: Routes = [
    { path: '', component: Reservas },
    { path: '**', redirectTo: '' },
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule],
})
export class AppRoutingModule {}
