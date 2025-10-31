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

  localData: FlynnIntent[] = [];
  flynnMenu: any = {};
  flynnHorarios: any = {};
  flynnKnowledge: any = {}; // unión de todos los JSON

  // === CONFIGURACIONES ===
  private readonly MAX_QUESTIONS = 10;
  private readonly MAX_CHARACTERS = 150;
  private readonly INSTAGRAM_URL = 'https://www.instagram.com/crissigel/';
  private readonly API_URL =
    window.location.hostname === 'localhost'
      ? 'http://localhost:4000/api/gemini'
      : '/api/gemini';

  constructor(private router: Router) {}

  async ngOnInit() {
    this.welcomeMessage();
    await this.loadLocalData();
  }

  // === CARGA DE JSON LOCALES ===
  async loadLocalData() {
    try {
      const [dataRes, menuRes, horariosRes] = await Promise.all([
        fetch('assets/flynn_data.json'),
        fetch('assets/flynn_menu.json'),
        fetch('assets/flynn_horarios.json'),
      ]);

      this.localData = await dataRes.json();
      this.flynnMenu = await menuRes.json();
      this.flynnHorarios = await horariosRes.json();

      this.flynnKnowledge = {
        ...this.flynnMenu,
        horarios: this.flynnHorarios,
        data: this.localData,
      };

      console.log('🧠 Datos locales cargados:', this.flynnKnowledge);
    } catch (error) {
      console.error('⚠️ Error al cargar datos locales:', error);
    }
  }

  // === MENSAJE INICIAL ===
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

  // === ENVÍO DE MENSAJES ===
  async sendMessage() {
    const text = this.userMessage.trim();
    if (!text) return;

    // Reiniciar conversación
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

    // Si menciona reservas → abrir modal
    if (lower.includes('reserva') || lower.includes('reservar')) {
      this.isTyping = false;
      this.showLimitModal = true;
      return;
    }

    // === PRIORIDAD 1: Menú ===
    const menuResponse = this.findInMenu(lower);
    if (menuResponse) {
      this.addBotMessage(menuResponse);
      this.isTyping = false;
      return;
    }

    // === PRIORIDAD 2: Horarios ===
    const horarioResponse = this.findInHorarios(lower);
    if (horarioResponse) {
      this.addBotMessage(horarioResponse);
      this.isTyping = false;
      return;
    }

    // === PRIORIDAD 3: Intenciones básicas (hola, gracias, etc.) ===
    const intentResponse = this.matchLocalIntent(lower);
    if (intentResponse) {
      this.addBotMessage(intentResponse);
      this.isTyping = false;
      return;
    }

    // === PRIORIDAD 4: Gemini ===
    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
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

  // === BÚSQUEDA LOCAL POR INTENCIONES ===
  matchLocalIntent(input: string): string | null {
    for (const intent of this.localData) {
      if (intent.patterns.some((p) => input.includes(p))) {
        const responses = intent.responses;
        return responses[Math.floor(Math.random() * responses.length)];
      }
    }
    return null;
  }

  // === BÚSQUEDA EN MENÚ ===
  findInMenu(input: string): string | null {
    if (!this.flynnMenu?.categorias) return null;

    // detecta palabras clave sobre comidas especiales
    const sinTacc = ['sin tacc', 'celíac', 'celiaco', 'celiaca'];
    const vegetariano = ['vegetariana', 'vegetariano', 'sin carne', 'vegana', 'vegano'];
    const sinSalsa = ['sin salsa', 'salsa aparte'];

    if (sinTacc.some((k) => input.includes(k))) {
      return '🍀 Tenemos opciones sin TACC, como papas, ensaladas y algunas pizzas especiales. Consultá al mozo al llegar.';
    }
    if (vegetariano.some((k) => input.includes(k))) {
      return '🥗 Contamos con opciones vegetarianas como pizzas capresse, rúcúla o fugazzeta, además de ensaladas.';
    }
    if (sinSalsa.some((k) => input.includes(k))) {
      return '🍟 Podés pedir cualquier plato sin salsa, nuestros cocineros te lo preparan a gusto.';
    }

    // búsqueda de ítems específicos
    for (const categoria of this.flynnMenu.categorias) {
      for (const item of categoria.items) {
        const nombreLower = item.nombre.toLowerCase();
        if (input.includes(nombreLower.split(' ')[0])) {
          return `🍀 Tenemos ${item.nombre} en la sección ${categoria.nombre}, a $${item.precio.toLocaleString('es-AR')}.`;
        }
      }
    }
    return null;
  }

  // === BÚSQUEDA EN HORARIOS ===
  findInHorarios(input: string): string | null {
    if (!this.flynnHorarios) return null;
    const keys = ['horario', 'abr', 'cerr', 'dias', 'cuándo', 'cuando'];
    if (keys.some((k) => input.includes(k))) {
      const { dias, apertura, cierre } = this.flynnHorarios;
      return `🕓 Abrimos ${dias} de ${apertura} a ${cierre}. ¡Te esperamos! 🍀`;
    }
    return null;
  }

  // === MANEJO DE MENSAJES ===
  addUserMessage(text: string) {
    this.messages.push({ id: Date.now().toString(), text, isBot: false, timestamp: new Date() });
  }

  addBotMessage(text: string) {
    this.messages.push({ id: (Date.now() + 1).toString(), text, isBot: true, timestamp: new Date() });
  }

  // === MODAL ===
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
