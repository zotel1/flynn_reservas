// src/app/components/reservas-dashboard/reservas-dashboard.ts
import {
  Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subject, of, fromEvent, timer } from 'rxjs';
import { takeUntil, catchError, finalize, tap, switchMap } from 'rxjs/operators';

declare global { interface Window { google: any } }

type ReservaItem = {
  timestamp?: string; nombre?: string; email?: string; telefono?: string;
  fecha?: string; hora?: string; personas?: number; comentario?: string;
  notas?: string; sitio?: string;
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
  private loggedIn = false;           // ← evita que checkSession() pise el estado
  private sessionCheckKilled = false; // ← para “cancelar” el primer check si ya logueamos

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
          if (this.sessionCheckKilled) return;        // ya logueamos → no tocar estado
          this.meEmail = me?.email || '';
          this.needsLogin = false;
          this.cdr.detectChanges();
        }),
        switchMap(() => this.cargar$()),
        catchError(() => {
          if (!this.loggedIn) {                       // solo si REALMENTE no logueamos
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
        if (el) g.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', type: 'standard' });
      } else {
        setTimeout(tryRender, 250);
      }
    };
    tryRender();
  }

  private onGoogleCredential(resp: any) {
    if (!resp?.credential) { this.error = 'No llegó credential de Google'; return; }

    this.loggedIn = true;            // ← marcamos antes para bloquear el catch del check inicial

    this.http.post('/api/auth/admin/login', { id_token: resp.credential }, { withCredentials: true })
      .pipe(
        tap(() => { this.needsLogin = false; this.error = ''; }),
        switchMap(() => timer(200)), // ← tiempo para que el navegador persista la cookie
        switchMap(() => this.http.get<any>('/api/auth/admin/me', { withCredentials: true })),
        tap(me => {
          this.meEmail = me?.email || '';
          this.sessionCheckKilled = true; // ← no permitir que el primer check pise el estado
          this.cdr.detectChanges();
        }),
        switchMap(() => this.cargar$()),
        catchError(e => { this.error = e?.error?.message || e?.message || 'No autorizado'; return of(null); }),
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
        this.cdr.detectChanges();
        this.renderGoogleButton();
      });
  }

  // ---------- FILTROS ----------
  aplicarFiltros() {
    if (this.filtro.hasta && this.filtro.desde && this.filtro.hasta < this.filtro.desde) {
      this.filtro.hasta = this.filtro.desde;
    }
    this.cargar();
  }
  limpiar() { this.setDefaultRange(); this.filtro.q = ''; this.cargar(); }

  itemsFiltrados(): ReservaItem[] {
    const q = this.filtro.q.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter(r => `${r.nombre} ${r.email} ${r.telefono}`.toLowerCase().includes(q));
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
          this.items = (resp?.items || []).map((r: any) => ({ ...r, personas: Number(r.personas || 0) }));
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
}
