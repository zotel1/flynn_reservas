import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-reservation-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './reservation-form.html',
  styleUrls: ['./reservation-form.css']
})
export class ReservationForm implements OnInit {
  form!: FormGroup;
  enviado = false;
  cargando = false;
  error = '';

  sitios = [
    { nombre: 'Barra Principal', icono: '🍺' },
    { nombre: 'Patio Cervecero', icono: '🌿' },
    { nombre: 'Área de Pool', icono: '🎱' },
    { nombre: 'Espacio de Juegos', icono: '🎮' },
    { nombre: 'Salón con TV', icono: '📺' },
    { nombre: 'Jardín Interior', icono: '☘️' },
  ];

  sitioSeleccionado: string | null = null;

  constructor(private fb: FormBuilder, private http: HttpClient) {}

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

  get f() { return this.form.controls; }

  seleccionarSitio(nombre: string) {
    this.sitioSeleccionado = nombre;
    this.form.patchValue({ sitio: nombre });
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando = true;
    this.enviado = false;
    this.error = '';

    // Payload que espera el serverless (/api/reservas)
    const v = this.form.value;
    const payload = {
      nombre: v.nombre,
      email: v.email,
      telefono: v.telefono,
      fecha: v.fecha,                 // yyyy-mm-dd
      hora: v.hora,                   // HH:mm
      personas: Number(v.personas),
      comentario: `[${v.sitio}] ${v.notas || ''}`, // guardamos sitio + notas
      sitio: v.sitio
    };

    try {
      // Si más adelante protegemos con API key del lado server, podrías
      // leer una key ingresada por el encargado desde localStorage.
      const headers = new HttpHeaders({
        'Content-Type': 'application/json'
        // 'x-api-key': localStorage.getItem('RESERVAS_API_KEY') || ''
      });

      await this.http.post('/api/reservas', payload, { headers }).toPromise();

      this.enviado = true;
      this.form.reset({ personas: 2 });
      this.sitioSeleccionado = null;
    } catch (e: any) {
      this.error = e?.error?.message || 'No se pudo enviar la reserva. Probá nuevamente en unos minutos.';
    } finally {
      this.cargando = false;
    }
  }
}
