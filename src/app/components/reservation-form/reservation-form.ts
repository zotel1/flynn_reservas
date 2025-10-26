import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reservation-form.html',
  styleUrls: ['./reservation-form.css']
})
export class ReservationForm implements OnInit {
  form: any;
  enviado = false;
  cargando = false;

  sitios = [
    { nombre: 'Barra Principal', icono: '🍺' },
    { nombre: 'Patio Cervecero', icono: '🌿' },
    { nombre: 'Área de Pool', icono: '🎱' },
    { nombre: 'Espacio de Juegos', icono: '🎮' },
    { nombre: 'Salón con TV', icono: '📺' },
    { nombre: 'Jardín Interior', icono: '☘️' },
  ];

  sitioSeleccionado: string | null = null;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      telefono: [''],
      fecha: ['', Validators.required],
      hora: ['', Validators.required],
      personas: [2, [Validators.required, Validators.min(1)]],
      notas: [''],
      sitio: ['', Validators.required],
    });
  }

  seleccionarSitio(nombre: string) {
    this.sitioSeleccionado = nombre;
    this.form.patchValue({ sitio: nombre });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando = true;
    this.enviado = false;

    setTimeout(() => {
      this.cargando = false;
      this.enviado = true;
      this.form.reset({ personas: 2 });
      this.sitioSeleccionado = null;
    }, 1500);
  }
}
