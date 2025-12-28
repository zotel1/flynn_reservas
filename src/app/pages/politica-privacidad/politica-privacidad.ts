import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-politica-privacidad',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './politica-privacidad.html',
  styleUrl: './politica-privacidad.css',
})
export class PoliticaPrivacidad {
    readonly currentYear: number = new Date().getFullYear();

}
