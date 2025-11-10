import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

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
export class ReservasDashboard implements OnInit {
  // --- Auth ---
  needsLogin = true;
  meEmail = '';
  clientId = ''; // lo leemos desde <meta name="google-client-id"> del index.html

  // --- UI / datos ---
  cargando = false;
  error = '';
  items: ReservaItem[] = [];
  kpiUltimos7 = 0;
  kpiProximos7 = 0;

  filtro = { desde: '', hasta: '', q: '' };

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    // 1) Client ID (desde el <meta> en index.html)
    const meta = document.querySelector('meta[name="google-client-id"]') as HTMLMetaElement | null;
    this.clientId = meta?.content || this.clientId || 'TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

    // 2) Rango por defecto: últimos 30 días
    const hoy = new Date();
    const hace30 = new Date(hoy.getTime() - 30 * 864e5);
    this.filtro.desde = hace30.toISOString().slice(0, 10);
    this.filtro.hasta = hoy.toISOString().slice(0, 10);

    // 3) Chequear sesión existente
    await this.checkSession();
  }

  // ---------- AUTH ----------
  private async checkSession() {
    try {
      const me: any = await this.http.get('/api/auth/admin/me').toPromise();
      this.meEmail = me?.email || '';
      this.needsLogin = false;
      this.cdr.detectChanges();         // fuerza render de la vista admin
      await this.cargar();
    } catch {
      this.needsLogin = true;
      this.cdr.detectChanges();         // asegura que se muestre el bloque de login
      this.renderGoogleButton();
    }
  }

  private renderGoogleButton() {
    // Render del botón de Google One Tap/Sign-In en <div id="googleBtn">
    const tryRender = () => {
      const g = (window as any).google;
      if (g?.accounts?.id) {
        g.accounts.id.initialize({
          client_id: this.clientId,
          callback: (resp: any) => this.onGoogleCredential(resp),
        });
        const el = document.getElementById('googleBtn');
        if (el) {
          g.accounts.id.renderButton(el, {
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            type: 'standard'
          });
        }
      } else {
        setTimeout(tryRender, 250);
      }
    };
    tryRender();
  }

  private async onGoogleCredential(resp: any) {
    try {
      if (!resp?.credential) throw new Error('No llegó credential de Google');
      await this.http.post('/api/auth/admin/login', { id_token: resp.credential }).toPromise();

      const me: any = await this.http.get('/api/auth/admin/me').toPromise();
      this.meEmail = me?.email || '';
      this.needsLogin = false;
      this.cdr.detectChanges();         // asegura que se pinte el dashboard
      await this.cargar();
    } catch (e: any) {
      console.error('login/admin error', e);
      this.error = e?.error?.message || e?.message || 'No autorizado';
    }
  }

  async logout() {
    try {
      await this.http.post('/api/auth/admin/logout', {}).toPromise();
    } finally {
      this.meEmail = '';
      this.items = [];
      this.kpiUltimos7 = 0;
      this.kpiProximos7 = 0;
      this.needsLogin = true;
      this.cdr.detectChanges();
      this.renderGoogleButton();
    }
  }

  // ---------- FILTROS ----------
  aplicarFiltros() { this.cargar(); }
  limpiar() { this.filtro = { desde: '', hasta: '', q: '' }; this.cargar(); }

  itemsFiltrados(): ReservaItem[] {
    const q = this.filtro.q.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter(r => `${r.nombre} ${r.email} ${r.telefono}`.toLowerCase().includes(q));
  }

  // ---------- CARGA ----------
  private async cargar() {
    if (this.needsLogin) return; // no pegamos si no hay sesión
    this.cargando = true;
    this.error = '';
    try {
      const params = new URLSearchParams();
      if (this.filtro.desde) params.set('desde', this.filtro.desde);
      if (this.filtro.hasta) params.set('hasta', this.filtro.hasta);
      if (this.filtro.q)     params.set('q', this.filtro.q);

      // Cookie HttpOnly maneja la auth → no enviar x-api-key
      const resp: any = await this.http.get(`/api/admin/reservas?${params.toString()}`).toPromise();
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
    } catch (e: any) {
      this.error = e?.error?.message || e?.message || 'No se pudieron cargar las reservas.';
      this.items = [];
      this.kpiUltimos7 = 0;
      this.kpiProximos7 = 0;
    } finally {
      this.cargando = false;
    }
  }
}
