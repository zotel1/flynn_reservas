import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-floating-buttons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './floating-buttons.html',
  styleUrls: ['./floating-buttons.css']
})
export class FloatingButtons {
  isLightMode = false;

  toggleTheme() {
    this.isLightMode = !this.isLightMode;
    const body = document.body;
    body.classList.toggle('light-mode', this.isLightMode);
  }

  openWhatsApp() {
    const phone = '5493764000000'; // ← reemplazá con el número real
    const message = encodeURIComponent('¡Hola Flynn Irish Bar! Quisiera hacer una reserva 🍀');
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  }
}
