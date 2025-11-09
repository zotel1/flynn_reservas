import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

type ReservaItem = {
  timestamp?: string;
  nombre?: string;
  email?: string;
  telefono?: string;
  fecha?: string;
  hora?: string;
  personas?: string | number;
  comentario?: string; // en Sheets
  notas?: string;      // si lo mapeás así desde el form
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
  cargando = false;
  error = '';
  items: ReservaItem[] = [];

  filtro = {
    desde: '',
    hasta: '',
    q: ''
  };

  kpiUltimos7 = 0;
  kpiProximos7 = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    // Por defecto: últimos 30 días
    const hoy = new Date();
    const hace30 = new Date(hoy.getTime() - 30 * 864e5);
    this.filtro.desde = hace30.toISOString().slice(0, 10);
    this.filtro.hasta = hoy.toISOString().slice(0, 10);
    this.cargar();
  }

  aplicarFiltros() {
    this.cargar();
  }

  limpiar() {
    this.filtro = { desde: '', hasta: '', q: '' };
    this.cargar();
  }

  itemsFiltrados(): ReservaItem[] {
    const q = this.filtro.q.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter(r =>
      `${r.nombre} ${r.email} ${r.telefono}`.toLowerCase().includes(q)
    );
  }

  private async cargar() {
    this.cargando = true;
    this.error = '';
    try {
      const params = new URLSearchParams();
      if (this.filtro.desde) params.set('desde', this.filtro.desde);
      if (this.filtro.hasta) params.set('hasta', this.filtro.hasta);

      const headers = new HttpHeaders({
        // Opcional: si protegés el endpoint con API key. Si no, borrá este header.
        'x-api-key': (window as any).ENV_RESERVAS_API_KEY || ''
      });

      const resp: any = await this.http
        .get(`/api/admin/reservas?${params.toString()}`, { headers })
        .toPromise();

      this.items = (resp?.items || []).map((r: any) => ({
        ...r,
        personas: Number(r.personas || 0)
      }));

      // KPIs rápidos
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
