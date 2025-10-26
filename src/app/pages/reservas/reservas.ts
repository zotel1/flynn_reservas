import { Component } from '@angular/core';
import { Hero } from '../../components/hero/hero';
import { Features } from '../../components/features/features';
import { ReservationForm } from '../../components/reservation-form/reservation-form';
import { Footer } from '../../components/footer/footer';
import { FloatingButtons } from '../../components/floating-buttons/floating-buttons';

@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [
    Hero,
    Features,
    ReservationForm,
    Footer,
    FloatingButtons
  ],
  templateUrl: './reservas.html',
  styleUrl: './reservas.css',
})
export class Reservas {

}
