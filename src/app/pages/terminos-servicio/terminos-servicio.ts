import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-terminos-servicio',
  imports: [],
  standalone: true,
  templateUrl: './terminos-servicio.html',
  styleUrl: './terminos-servicio.css',
})
export class TerminosServicio {
readonly currentYear: number = new Date().getFullYear();
}
