// src/app/components/reservas-dashboard/reservas-dashboard.ts
import {
  Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subject, of, fromEvent, timer } from 'rxjs';
import { takeUntil, catchError, finalize, tap, switchMap } from 'rxjs/operators';
import jsQR from 'jsqr';

declare global {
  interface Window {
    google: any;
    BarcodeDetector?: any;
  }
}

type ReservaItem = {
  timestamp?: string; nombre?: string; email?: string; telefono?: string;
  fecha?: string; hora?: string; personas?: number; comentario?: string;
  notas?: string; sitio?: string;
  qr_url?: string;
};

@Component({
  selector: 'app-reservas-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './reservas-dashboard.html',
  styleUrls: ['./reservas-dashboard.css']
})
export class ReservasDashboard implements OnInit, OnDestroy {
  needsLogin = true;
  meEmail = '';
  clientId = '';

  cargando = false;
  error = '';
  items: ReservaItem[] = [];
  kpiUltimos7 = 0;
  kpiProximos7 = 0;

  filtro = { desde: '', hasta: '', q: '' };

  private readonly DEFAULT_PAST_DAYS = 30;
  private readonly DEFAULT_FUTURE_DAYS = 60;

  private destroy$ = new Subject<void>();
  private loggedIn = false;
  private sessionCheckKilled = false;

  // ----- Estado de detalle / QR -----
  selected: ReservaItem | null = null;   // reserva clickeada
  scanActive = false;
  scanMessage = '';
  scanMatch: ReservaItem | null = null;
  scanTarget: ReservaItem | null = null; // contra quién comparamos el QR

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    const meta = document.querySelector('meta[name="google-client-id"]') as HTMLMetaElement | null;
    this.clientId = meta?.content || 'TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

    this.setDefaultRange();

    fromEvent(window, 'focus')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => { if (!this.needsLogin) this.cargar(); });

    this.checkSession();
  }

  ngOnDestroy(): void {
    this.destroy$.next(); this.destroy$.complete();
    this.stopScan();
  }

  private ymdLocal(d: Date): string {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  }
  private addDays(base: Date, days: number) { return new Date(base.getTime() + days * 864e5); }

  private setDefaultRange() {
    const hoy = new Date();
    this.filtro.desde = this.ymdLocal(this.addDays(hoy, -this.DEFAULT_PAST_DAYS));
    this.filtro.hasta = this.ymdLocal(this.addDays(hoy,  this.DEFAULT_FUTURE_DAYS));
  }

  // ---------- AUTH ----------
  private checkSession() {
    this.http.get<any>('/api/auth/admin/me', { withCredentials: true })
      .pipe(
        tap(me => {
          if (this.sessionCheckKilled) return;
          this.meEmail = me?.email || '';
          this.needsLogin = false;
          this.cdr.detectChanges();
        }),
        switchMap(() => this.cargar$()),
        catchError(() => {
          if (!this.loggedIn) {
            this.needsLogin = true;
            this.cdr.detectChanges();
            this.renderGoogleButton();
          }
          return of(null);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  private renderGoogleButton() {
    const tryRender = () => {
      const g = (window as any).google;
      if (g?.accounts?.id) {
        g.accounts.id.initialize({
          client_id: this.clientId,
          callback: (resp: any) => this.zone.run(() => this.onGoogleCredential(resp)),
        });
        const el = document.getElementById('googleBtn');
        if (el) g.accounts.id.renderButton(el, {
          theme: 'outline', size: 'large', shape: 'pill', type: 'standard'
        });
      } else {
        setTimeout(tryRender, 250);
      }
    };
    tryRender();
  }

  private onGoogleCredential(resp: any) {
    if (!resp?.credential) { this.error = 'No llegó credential de Google'; return; }

    this.loggedIn = true;

    this.http.post('/api/auth/admin/login', { id_token: resp.credential }, { withCredentials: true })
      .pipe(
        tap(() => { this.needsLogin = false; this.error = ''; }),
        switchMap(() => timer(200)),
        switchMap(() => this.http.get<any>('/api/auth/admin/me', { withCredentials: true })),
        tap(me => {
          this.meEmail = me?.email || '';
          this.sessionCheckKilled = true;
          this.cdr.detectChanges();
        }),
        switchMap(() => this.cargar$()),
        catchError(e => {
          this.error = e?.error?.message || e?.message || 'No autorizado';
          return of(null);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  logout() {
    this.http.post('/api/auth/admin/logout', {}, { withCredentials: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loggedIn = false;
        this.sessionCheckKilled = false;
        this.meEmail = '';
        this.items = [];
        this.kpiUltimos7 = 0;
        this.kpiProximos7 = 0;
        this.needsLogin = true;
        this.selected = null;
        this.scanMessage = '';
        this.scanMatch = null;
        this.cdr.detectChanges();
        this.renderGoogleButton();
        this.stopScan();
      });
  }

  // ---------- FILTROS ----------
  aplicarFiltros() {
    if (this.filtro.hasta && this.filtro.desde && this.filtro.hasta < this.filtro.desde) {
      this.filtro.hasta = this.filtro.desde;
    }
    this.cargar();
  }

  limpiar() {
    this.setDefaultRange();
    this.filtro.q = '';
    this.cargar();
  }

  itemsFiltrados(): ReservaItem[] {
    const q = this.filtro.q.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter(r =>
      `${r.nombre} ${r.email} ${r.telefono}`.toLowerCase().includes(q)
    );
  }

  // ---------- CARGA ----------
  private cargar$() {
    if (this.needsLogin) return of(null);
    this.cargando = true;

    const params = new URLSearchParams();
    if (this.filtro.desde) params.set('desde', this.filtro.desde);
    if (this.filtro.hasta) params.set('hasta', this.filtro.hasta);
    if (this.filtro.q)     params.set('q', this.filtro.q);

    return this.http.get<any>(`/api/admin/reservas?${params.toString()}`, { withCredentials: true })
      .pipe(
        tap(resp => {
          this.items = (resp?.items || []).map((r: any) => ({
            ...r,
            personas: Number(r.personas || 0)
          }));
          const ahora = Date.now(), ms7 = 7 * 864e5;
          this.kpiUltimos7 = this.items.filter(r => {
            const t = Date.parse(r.timestamp || `${r.fecha}T${r.hora || '00:00'}:00`);
            return !isNaN(t) && t >= (ahora - ms7) && t <= ahora;
          }).length;
          this.kpiProximos7 = this.items.filter(r => {
            const t = Date.parse(`${r.fecha}T${r.hora || '00:00'}:00`);
            return !isNaN(t) && t > ahora && t <= (ahora + ms7);
          }).length;
          this.error = '';
        }),
        catchError(e => {
          this.error = e?.error?.message || e?.message || 'No se pudieron cargar las reservas.';
          this.items = []; this.kpiUltimos7 = 0; this.kpiProximos7 = 0;
          return of(null);
        }),
        finalize(() => { this.cargando = false; })
      );
  }

  private cargar() { this.cargar$().pipe(takeUntil(this.destroy$)).subscribe(); }

  // ---------- Selección de reserva ----------
  selectReserva(r: ReservaItem) {
    this.selected = r;
    this.scanMessage = '';
    this.scanMatch = null;
  }

  // ---------- ESCÁNER DE QR ----------
  async startScan(target?: ReservaItem) {
  this.scanMessage = '';
  this.scanMatch = null;
  this.scanTarget = target || null;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    this.scanMessage = 'Este dispositivo no permite acceder a la cámara.';
    return;
  }

  const hasNativeDetector =
    typeof (window as any).BarcodeDetector === 'function';

  const video = document.getElementById('qrVideo') as HTMLVideoElement | null;
  if (!video) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    video.srcObject = stream;
    await video.play();
    this.scanActive = true;

    const nativeDetector = hasNativeDetector
      ? new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      : null;

    const scanFrame = async () => {
      if (!this.scanActive) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      if (video.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          try {
            let raw = '';

            if (nativeDetector) {
              // ✅ Camino 1: usar BarcodeDetector si existe
              const codes = await nativeDetector.detect(canvas);
              if (codes.length) {
                raw = (codes[0] as any).rawValue || '';
              }
            } else {
              // ✅ Camino 2 (fallback): jsQR en cualquier navegador
              const imageData = ctx.getImageData(
                0, 0, canvas.width, canvas.height
              );
              const result = (jsQR as any)(
                imageData.data,
                imageData.width,
                imageData.height
              );
              if (result && result.data) {
                raw = result.data;
              }
            }

            if (raw) {
              this.zone.run(() => this.onQrDecoded(raw));
              this.scanActive = false;
              stream.getTracks().forEach(t => t.stop());
              return;
            }
          } catch {
            // ignoramos errores de lectura en un frame
          }
        }
      }

      requestAnimationFrame(scanFrame);
    };

    requestAnimationFrame(scanFrame);
  } catch (e: any) {
    this.scanMessage = e?.message || 'No se pudo iniciar la cámara.';
  }
}

  stopScan() {
    this.scanActive = false;
    const video = document.getElementById('qrVideo') as HTMLVideoElement | null;
    const stream = (video?.srcObject as MediaStream | null);
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (video) video.srcObject = null;
  }

  private reservasCoinciden(r: ReservaItem, payload: any): boolean {
    return (
      (r.email || '').toLowerCase() === String(payload.email || '').toLowerCase() &&
      (r.fecha || '')               === String(payload.fecha || '') &&
      (r.hora || '')                === String(payload.hora || '') &&
      (r.sitio || '')               === String(payload.sitio || '') &&
      Number(r.personas || 0)       === Number(payload.personas || 0)
    );
  }

  private onQrDecoded(raw: string) {
    let payload: any;

    try {
      payload = JSON.parse(raw);
    } catch {
      this.scanMessage = 'No se pudo interpretar el QR (formato inválido).';
      this.scanMatch = null;
      return;
    }

    if (payload?.type !== 'flynn-reserva') {
      this.scanMessage = 'Este QR no corresponde a una reserva de Flynn.';
      this.scanMatch = null;
      return;
    }

    // Si hay una reserva seleccionada, comparamos contra esa
    if (this.scanTarget) {
      if (this.reservasCoinciden(this.scanTarget, payload)) {
        this.scanMatch = this.scanTarget;
        this.scanMessage = '✅ QR válido para la reserva seleccionada.';
      } else {
        this.scanMatch = null;
        this.scanMessage = '⚠️ El QR no coincide con la reserva seleccionada.';
      }
      return;
    }

    // Modo fallback: buscar en toda la lista
    const match = this.items.find(r => this.reservasCoinciden(r, payload));

    if (match) {
      this.scanMatch = match;
      this.scanMessage = '✅ Reserva válida';
    } else {
      this.scanMatch = null;
      this.scanMessage = '⚠️ QR leído, pero la reserva no se encontró en el listado actual.';
    }
  }
}
