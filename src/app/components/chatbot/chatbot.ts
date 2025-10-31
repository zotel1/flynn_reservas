import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Footer } from '../footer/footer';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

interface FlynnIntent {
  tag: string;
  patterns: string[];
  responses: string[];
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, Footer],
  templateUrl: './chatbot.html',
  styleUrls: ['./chatbot.css'],
})
export class Chatbot {
  messages: Message[] = [];
  userMessage = '';
  isTyping = false;
  userQuestionCount = 0;
  showLimitModal = false;

  // === Memoria local ===
  localData: FlynnIntent[] = [];
  flynnMenu: any = {};
  flynnHorarios: any = {};
  flynnTraining: any = {};
  flynnKnowledge: any = {};
  currentTopic: string | null = null; // memoria temática simple

  // === Configuraciones ===
  private readonly MAX_QUESTIONS = 10;
  private readonly MAX_CHARACTERS = 150;
  private readonly INSTAGRAM_URL = 'https://www.instagram.com/crissigel/';
  private readonly API_URL =
    window.location.hostname === 'localhost'
      ? 'http://localhost:4000/api/gemini'
      : '/api/gemini';

  constructor(private router: Router) {}

  // === Inicialización ===
  async ngOnInit() {
    this.welcomeMessage();
    await this.loadLocalData();
  }

  // === Carga de datos locales ===
  async loadLocalData() {
    try {
      const [dataRes, menuRes, horariosRes, entrenamientoRes] = await Promise.all([
        fetch('assets/flynn_data.json'),
        fetch('assets/flynn_menu.json'),
        fetch('assets/flynn_horarios.json'),
        fetch('assets/entrenamiento.json'),
      ]);

      this.localData = await dataRes.json();
      this.flynnMenu = await menuRes.json();
      this.flynnHorarios = await horariosRes.json();
      this.flynnTraining = await entrenamientoRes.json();

      this.flynnKnowledge = {
        ...this.flynnMenu,
        horarios: this.flynnHorarios,
        data: this.localData,
      };

      console.log('🧠 Datos locales cargados correctamente:', this.flynnKnowledge);
    } catch (error) {
      console.error('⚠️ Error al cargar datos locales:', error);
    }
  }

  // === Mensaje inicial ===
  welcomeMessage() {
    this.messages = [
      {
        id: '1',
        text: '¡Bienvenido a Flynn Irish Pub! 🍀 Soy tu asistente virtual. Puedo ayudarte con horarios, menú, eventos o reservas. ¿En qué te ayudo hoy?',
        isBot: true,
        timestamp: new Date(),
      },
    ];
  }

  // === Envío de mensajes ===
  async sendMessage() {
    const text = this.userMessage.trim();
    if (!text) return;

    // Reinicio manual
    if (text.toLowerCase().includes('reiniciar') || text.toLowerCase().includes('borrar')) {
      this.welcomeMessage();
      this.userMessage = '';
      await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'reiniciar' }),
      });
      return;
    }

    // Validaciones
    if (text.length > this.MAX_CHARACTERS) {
      this.addBotMessage(`⚠️ Escribí menos de ${this.MAX_CHARACTERS} caracteres, por favor.`);
      this.userMessage = '';
      return;
    }

    if (this.userQuestionCount >= this.MAX_QUESTIONS) {
      this.showLimitModal = true;
      return;
    }

    this.addUserMessage(text);
    this.userMessage = '';
    this.userQuestionCount++;
    this.isTyping = true;

    const lower = text.toLowerCase();

    // === Detección de tema (memoria simple) ===
    if (/(pizza|papas|hamburg|lomo|milanesa|ensalada|empanada)/i.test(lower)) {
      this.currentTopic = 'comidas';
    } else if (/(birra|cerveza|vino|whisky|trago|licuado|jugo)/i.test(lower)) {
      this.currentTopic = 'bebidas';
    } else if (/(horario|abr|cier|días)/i.test(lower)) {
      this.currentTopic = 'horarios';
    } else if (/(reserva|mesa|turno)/i.test(lower)) {
      this.currentTopic = 'reservas';
    }

    // Si menciona reserva → modal
    if (this.currentTopic === 'reservas') {
      this.isTyping = false;
      this.showLimitModal = true;
      return;
    }

    // === Prioridad de respuestas locales ===
    const localResponse =
      this.matchLocalIntent(lower) ||
      this.matchTrainingIntent(lower) ||
      this.findInMenu(lower) ||
      this.findInHorarios(lower);

    if (localResponse) {
      this.addBotMessage(localResponse);
      this.isTyping = false;
      return;
    }

    // === Gemini ===
    try {
      const context = `
      Sos Flynn Assistant 🍀, asistente virtual del Flynn Irish Pub.
      Tema actual del usuario: ${this.currentTopic || 'general'}.
      Estos son algunos datos locales del bar:
      ${JSON.stringify(this.flynnKnowledge).slice(0, 1500)} 
      `.trim();

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `${context}\nUsuario: ${text}`,
          history: this.messages.map((m) => ({ text: m.text, isBot: m.isBot })),
        }),
      });

      if (!response.ok) {
        this.addBotMessage('⚠️ No pude conectar con el servidor. Intentá más tarde.');
        return;
      }

      const data = await response.json();
      this.addBotMessage(data.reply || 'No pude entenderte 🍀');
    } catch (error) {
      console.error('Error al conectar con Gemini:', error);
      this.addBotMessage('⚠️ Error al conectar con el asistente. Intentá más tarde.');
    } finally {
      this.isTyping = false;
    }
  }

  // === Intenciones básicas ===
  matchLocalIntent(input: string): string | null {
    for (const intent of this.localData) {
      if (intent.patterns.some((p) => input.includes(p))) {
        const responses = intent.responses;
        return responses[Math.floor(Math.random() * responses.length)];
      }
    }
    return null;
  }

  // === Entrenamiento personalizado ===
  matchTrainingIntent(input: string): string | null {
    if (!this.flynnTraining?.entrenamiento) return null;

    for (const entry of this.flynnTraining.entrenamiento) {
      if (entry.patterns.some((p:any) => input.includes(p))) {
        return entry.responses[Math.floor(Math.random() * entry.responses.length)];
      }
    }
    return null;
  }

  findInMenu(input: string): string | null {
  if (!this.flynnMenu?.categorias) return null;

  const sinTacc = ['sin tacc', 'celíac', 'celiaco', 'celiaca'];
  const vegetariano = ['vegetariana', 'vegetariano', 'sin carne', 'vegana', 'vegano'];
  const sinSalsa = ['sin salsa', 'salsa aparte'];
  const masOpciones = ['otras', 'más', 'variedades', 'diferentes', 'distintas'];

  // === OPCIONES ESPECIALES ===
  if (sinTacc.some((k) => input.includes(k))) {
    return '🍀 Tenemos opciones sin TACC, como papas, ensaladas y algunas pizzas especiales. Consultá al mozo al llegar.';
  }
  if (vegetariano.some((k) => input.includes(k))) {
    return '🥗 Contamos con opciones vegetarianas como pizzas capresse, rúcula o fugazzeta, además de ensaladas.';
  }
  if (sinSalsa.some((k) => input.includes(k))) {
    return '🍟 Podés pedir cualquier plato sin salsa, nuestros cocineros te lo preparan a gusto.';
  }

  // === DETECCIÓN DE CATEGORÍA ===
  let categoriaDetectada = null;
  for (const categoria of this.flynnMenu.categorias) {
    if (input.includes(categoria.nombre.toLowerCase())) {
      categoriaDetectada = categoria;
      break;
    }
  }

  // === SI PIDE "OTRAS OPCIONES" DE UN TEMA PREVIO ===
  if (masOpciones.some((k) => input.includes(k)) && this.currentTopic === 'comidas') {
    const pizzas = this.flynnMenu.categorias.find((c:any) =>
      c.nombre.toLowerCase().includes('pizza')
    );
    if (pizzas) {
      const lista = pizzas.items.map((p: any) => `• ${p.nombre} ($${p.precio.toLocaleString('es-AR')})`).join('\n');
      return `🍕 Claro, mirá todas nuestras pizzas disponibles:\n${lista}\n🍀 ¡Elegí la que más te guste!`;
    }
  }

  // === BÚSQUEDA POR PALABRA CLAVE DE PRODUCTO ===
  for (const categoria of this.flynnMenu.categorias) {
    for (const item of categoria.items) {
      const nombreLower = item.nombre.toLowerCase();
      if (input.includes(nombreLower.split(' ')[0])) {
        this.currentTopic = 'comidas';
        return `🍀 Tenemos ${item.nombre} en la sección ${categoria.nombre}, a $${item.precio.toLocaleString('es-AR')}.`;
      }
    }
  }

  // === SI HABLA DE PIZZAS O EMPANADAS PERO SIN MATCH EXACTO ===
  if (input.includes('pizza')) {
    const pizzas = this.flynnMenu.categorias.find((c:any) =>
      c.nombre.toLowerCase().includes('pizza')
    );
    if (pizzas) {
      const lista = pizzas.items.map((p: any) => `• ${p.nombre} ($${p.precio.toLocaleString('es-AR')})`).join('\n');
      this.currentTopic = 'comidas';
      return `🍕 Estas son algunas de nuestras pizzas:\n${lista}`;
    }
  }

  if (input.includes('empanad')) {
    const empanadas = this.flynnMenu.categorias.find((c:any) =>
      c.nombre.toLowerCase().includes('empanada')
    );
    if (empanadas) {
      const lista = empanadas.items.map((e: any) => `• ${e.nombre} ($${e.precio.toLocaleString('es-AR')})`).join('\n');
      this.currentTopic = 'comidas';
      return `🥟 Tenemos varias empanadas:\n${lista}\n🍀 Podés pedirlas individuales o por docena.`;
    }
  }

  return null;
}
  // === Búsqueda en horarios ===
  findInHorarios(input: string): string | null {
    if (!this.flynnHorarios?.categorias) return null;
    const palabras = ['horario', 'abr', 'cerr', 'dias', 'cuándo', 'cuando'];

    if (palabras.some((p) => input.includes(p))) {
      let respuesta = '🕓 Nuestros horarios:\n';
      for (const categoria of this.flynnHorarios.categorias) {
        respuesta += `\n📋 ${categoria.nombre}:\n`;
        for (const item of categoria.items) {
          if (item.dia && item.horario) {
            respuesta += `• ${item.dia}: ${item.horario}\n`;
          }
        }
      }
      this.currentTopic = 'horarios';
      return respuesta.trim() + '\n🍀 ¡Te esperamos en Flynn!';
    }

    return null;
  }

  // === Manejo de mensajes ===
  addUserMessage(text: string) {
    this.messages.push({
      id: Date.now().toString(),
      text,
      isBot: false,
      timestamp: new Date(),
    });
  }

  addBotMessage(text: string) {
    this.messages.push({
      id: (Date.now() + 1).toString(),
      text,
      isBot: true,
      timestamp: new Date(),
    });
  }

  // === Modal ===
  onConfirmReserve() {
    this.showLimitModal = false;
    this.router.navigate(['/reservas']);
  }

  onDeclineReserve() {
    this.showLimitModal = false;
    if (this.userQuestionCount >= this.MAX_QUESTIONS) {
      this.addBotMessage('¡Gracias por charlar conmigo! 🍀 Te invito a seguirnos en Instagram 💚');
      setTimeout(() => (window.location.href = this.INSTAGRAM_URL), 2500);
    } else {
      this.addBotMessage('¡Entendido! 🍀 Si más adelante querés hacer una reserva, seguinos en Instagram 💚');
      setTimeout(() => (window.location.href = this.INSTAGRAM_URL), 2000);
      this.userQuestionCount = 0;
    }
  }
}
