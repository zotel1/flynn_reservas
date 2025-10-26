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
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando = true;
    this.enviado = false;

    // Simulación de envío
    setTimeout(() => {
      this.cargando = false;
      this.enviado = true;
      this.form.reset({ personas: 2 });
    }, 1500);
  }
}
