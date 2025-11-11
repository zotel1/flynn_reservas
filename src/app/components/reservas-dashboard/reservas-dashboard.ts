import {
  Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import {
  Subject, of, fromEvent
} from 'rxjs';
import {
  takeUntil, catchError, finalize, tap, switchMap
} from 'rxjs/operators';

declare global { interface Window { google: any } }

type ReservaItem = {
  timestamp?: string;
  nombre?: string;
  email?: string;
  telefono?: string;
  fecha?: string;
  hora?: string;
  personas?: number;
  comentario?: string;
  notas?: string;
  sitio?: string;
};

@Component({
  selector: 'app-reservas-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './reservas-dashboard.html',
  styleUrls: ['./reservas-dashboard.css']
})
export class ReservasDashboard implements OnInit, OnDestroy {
  // --- Auth ---
  needsLogin = true;
  meEmail = '';
  clientId = ''; // <meta name="google-client-id">

  // --- UI / datos ---
  cargando = false;
  error = '';
  items: ReservaItem[] = [];
  kpiUltimos7 = 0;
  kpiProximos7 = 0;

  // Filtros
  filtro = { desde: '', hasta: '', q: '' };

  private readonly DEFAULT_PAST_DAYS = 30;
  private readonly DEFAULT_FUTURE_DAYS = 60;

  private destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    const meta = document.querySelector('meta[name="google-client-id"]') as HTMLMetaElement | null;
    this.clientId = meta?.content || 'TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

    this.setDefaultRange();

    // recargar cuando la pestaña vuelve a estar al frente
    fromEvent(window, 'focus')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => { if (!this.needsLogin) this.cargar(); });

    this.checkSession();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- Helpers fecha ----------
  private ymdLocal(d: Date): string {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  }
  private addDays(base: Date, days: number) {
    return new Date(base.getTime() + days * 864e5);
  }
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
          this.meEmail = me?.email || '';
          this.needsLogin = false;
          this.cdr.detectChanges();
        }),
        switchMap(() => this.cargar$()),
        catchError(() => {
          this.needsLogin = true;
          this.cdr.detectChanges();
          this.renderGoogleButton();
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
          // importantísimo: entrar a la zona de Angular
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
    if (!resp?.credential) {
      this.error = 'No llegó credential de Google';
      return;
    }
    this.http.post('/api/auth/admin/login', { id_token: resp.credential }, { withCredentials: true })
      .pipe(
        tap(() => {
          this.needsLogin = false;
          this.error = '';
        }),
        switchMap(() => this.http.get<any>('/api/auth/admin/me', { withCredentials: true })),
        tap(me => {
          this.meEmail = me?.email || '';
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

  limpiar() {
    this.setDefaultRange();
    this.filtro.q = '';
    this.cargar();
  }

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
          // KPIs
          const ahora = Date.now();
          const ms7 = 7 * 864e5;
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
          this.items = [];
          this.kpiUltimos7 = 0;
          this.kpiProximos7 = 0;
          return of(null);
        }),
        finalize(() => { this.cargando = false; })
      );
  }

  private cargar() {
    this.cargar$().pipe(takeUntil(this.destroy$)).subscribe();
  }
}
