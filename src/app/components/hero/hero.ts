import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from "@angular/router";

@Component({
  selector: 'app-hero',
  standalone: true,
  templateUrl: './hero.html',
  styleUrls: ['./hero.css'],
  imports: []
})
export class Hero implements OnInit, OnDestroy {
  imagenActual = '';
  indice = 0;
  intervalo: any;

  imagenesDesktop = [
    'assets/flynn/4.jpeg',
    'assets/flynn/6.jpeg',
    'assets/flynn/7.jpeg',
    'assets/flynn/9.jpeg',
    'assets/flynn/10.jpeg'
  ];

  imagenesMobile = [
    'assets/flynn/1.jpeg',
    'assets/flynn/2.jpeg',
    'assets/flynn/3.jpeg',
    'assets/flynn/5.jpeg',
    'assets/flynn/8.jpeg'
  ];

  scrollToReserva() {
    const section = document.getElementById('reservar');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  }

  get imagenes() {
    return window.innerWidth > 768 ? this.imagenesDesktop : this.imagenesMobile;
  }

  ngOnInit() {
    this.cambiarImagen(); // inicializa la primera imagen
    this.intervalo = setInterval(() => this.cambiarImagen(), 6000);
  }

  cambiarImagen() {
    const lista = this.imagenes;
    this.imagenActual = lista[this.indice];
    this.indice = (this.indice + 1) % lista.length;
  }

  ngOnDestroy() {
    clearInterval(this.intervalo);
  }
}


