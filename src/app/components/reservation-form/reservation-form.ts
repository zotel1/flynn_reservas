import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

type PaidFlag = '1' | '0' | 'pending' | '';

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

  // --- Pago / seña ---
  paid: PaidFlag = '';
  paying = false;
  amount = 0; // se completa desde /api/pay/config o usa fallback
  desc = 'Seña reserva Flynn Irish Pub';
  extRef = ''; // external_reference para enlazar seña ↔ reserva

  sitios = [
    { nombre: 'Barra Principal', icono: '🍺' },
    { nombre: 'Patio Cervecero', icono: '🌿' },
    { nombre: 'Área de Pool', icono: '🎱' },
    { nombre: 'Espacio de Juegos', icono: '🎮' },
    { nombre: 'Salón con TV', icono: '📺' },
    { nombre: 'Jardín Interior', icono: '☘️' },
  ];
  sitioSeleccionado: string | null = null;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // 1) Form reactivo
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

    // 2) Leer ?paid= de la URL (vuelta de Mercado Pago)
    this.route.queryParamMap.subscribe(q => {
      this.paid = (q.get('paid') || '') as PaidFlag;
    });

    // 3) External reference persistente por cliente
    const saved = localStorage.getItem('pay_extref');
    this.extRef = saved || this.makeExtRef();
    if (!saved) localStorage.setItem('pay_extref', this.extRef);

    // 4) (Opcional) Traer monto/desc desde serverless
    this.http.get('/api/pay/config').subscribe({
      next: (r: any) => {
        this.amount = Number(r?.amount ?? 10);
        this.desc   = String(r?.desc ?? this.desc);
      },
      error: () => {
        this.amount = this.amount || 10; // fallback
      }
    });
  }

  // Genera una referencia corta única (local a este browser)
  private makeExtRef(): string {
    const rnd = new Uint8Array(12);
    window.crypto.getRandomValues(rnd);
    return 'flynn_' + Array.from(rnd).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  get f() { return this.form.controls; }
  get formBloqueado(): boolean { return this.paid !== '1'; }

  seleccionarSitio(nombre: string) {
    this.sitioSeleccionado = nombre;
    this.form.patchValue({ sitio: nombre });
  }

  // === Paso 1: iniciar pago (redirige a la app/web de MP) ===
  async iniciarPago() {
    this.error = '';
    this.paying = true;
    try {
      const res: any = await firstValueFrom(
        this.http.post('/api/pay/create-preference', { external_reference: this.extRef })
      );
      const url = res.init_point || res.sandbox_init_point || res.url;
      if (!url) throw new Error('No se pudo obtener el link de pago.');
      window.location.href = url;
    } catch (e: any) {
      this.error = e?.error?.message || e?.message || 'No se pudo iniciar el pago';
    } finally {
      this.paying = false;
    }
  }

  // === Paso 2: enviar la reserva (solo si paid=1) ===
  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.formBloqueado) {
      this.error = `Antes de confirmar la reserva, aboná la seña de $${this.amount}.`;
      return;
    }

    this.cargando = true;
    this.enviado = false;
    this.error = '';

    const v = this.form.value;
    const payload = {
      nombre: v.nombre,
      email: v.email,
      telefono: v.telefono,
      fecha: v.fecha,                 // yyyy-mm-dd
      hora: v.hora,                   // HH:mm
      personas: Number(v.personas),
      comentario: `[${v.sitio}] ${v.notas || ''}`,
      sitio: v.sitio,
      pay_ref: this.extRef            // <-- útil para conciliar en dashboard / back
    };

    try {
      const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
      const res: any = await firstValueFrom(this.http.post('/api/reservas', payload, { headers }));

      if (!res?.ok) throw new Error(res?.message || 'No se pudo crear la reserva');

      this.enviado = true;
      this.form.reset({ personas: 2 });
      this.sitioSeleccionado = null;

      // limpiar referencia y el ?paid= de la URL para próximos intentos
      localStorage.removeItem('pay_extref');
      this.router.navigate([], { queryParams: { paid: null }, queryParamsHandling: 'merge' });
    } catch (e: any) {
      this.error = e?.error?.message || e?.message || 'No se pudo enviar la reserva. Probá nuevamente.';
    } finally {
      this.cargando = false;
    }
  }
}
