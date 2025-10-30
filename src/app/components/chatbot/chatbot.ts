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

  // === CONFIGURACIONES ===
  private readonly MAX_QUESTIONS = 10;
  private readonly MAX_CHARACTERS = 100;
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

  async loadLocalData() {
    try {
      const response = await fetch('assets/flynn_data.json');
      this.localData = await response.json();
    } catch (error) {
      console.error('⚠️ Error al cargar datos locales:', error);
    }
  }

  welcomeMessage() {
    this.messages = [
      {
        id: '1',
        text: '¡Bienvenido a Flynn Irish Pub! 🍀 Soy tu asistente virtual. Puedo ayudarte con horarios, eventos, menú o reservas. ¿En qué te ayudo hoy?',
        isBot: true,
        timestamp: new Date(),
      },
    ];
  }

  async sendMessage() {
    const text = this.userMessage.trim();
    if (!text) return;

    // Reinicio manual del chat
    if (text.toLowerCase().includes('reiniciar') || text.toLowerCase().includes('borrar')) {
      this.welcomeMessage();
      this.userMessage = '';
      try {
        await fetch(this.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'reiniciar' }),
        });
      } catch (_) {}
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

    // Si menciona reservas, abrir modal
    if (lower.includes('reserva') || lower.includes('reservar')) {
      this.isTyping = false;
      this.showLimitModal = true;
      return;
    }

    // Intento de respuesta local
    const localResponse = this.matchLocalIntent(lower);
    if (localResponse) {
      this.addBotMessage(localResponse);
      this.isTyping = false;
      return;
    }

    // Si no hay coincidencia local, usar Gemini
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

  matchLocalIntent(input: string): string | null {
    for (const intent of this.localData) {
      if (intent.patterns.some((p) => input.includes(p))) {
        const responses = intent.responses;
        return responses[Math.floor(Math.random() * responses.length)];
      }
    }
    return null;
  }

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

  // === MODAL ===
  onConfirmReserve() {
    this.showLimitModal = false;
    this.router.navigate(['/reservas']);
  }
onDeclineReserve() {
  this.showLimitModal = false;

  // ✅ Si ya alcanzó el límite, redirige a Instagram
  if (this.userQuestionCount >= this.MAX_QUESTIONS) {
    this.addBotMessage('¡Gracias por charlar conmigo! 🍀 Te invito a seguirnos en Instagram 💚');
    setTimeout(() => {
      window.location.href = this.INSTAGRAM_URL; // redirige directo al Instagram
    }, 2500);
  } else {
    this.addBotMessage('¡Entendido! 🍀 Si más adelante querés hacer una reserva, seguinos en Instagram 💚');
    setTimeout(() => {
      window.location.href = this.INSTAGRAM_URL; // también redirige al Instagram
    }, 2000);
    this.userQuestionCount = 0;
  }
}
}

