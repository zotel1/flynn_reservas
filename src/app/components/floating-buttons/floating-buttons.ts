import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-floating-buttons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './floating-buttons.html',
  styleUrls: ['./floating-buttons.css']
})
export class FloatingButtons implements OnInit {
  isLightMode = false;

  ngOnInit() {
    // Mantener el tema al recargar la página
    const savedTheme = localStorage.getItem('flynn-theme');
    if (savedTheme === 'light') {
      this.isLightMode = true;
      document.body.classList.add('light-mode');
    }
  }

  toggleTheme() {
    this.isLightMode = !this.isLightMode;
    const body = document.body;
    body.classList.toggle('light-mode', this.isLightMode);
    localStorage.setItem('flynn-theme', this.isLightMode ? 'light' : 'dark');
  }

  openWhatsApp() {
    const phone = '5493764000000'; // número real
    const message = encodeURIComponent('¡Hola Flynn Irish Bar! Quisiera hacer una reserva 🍀');
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  }
}
