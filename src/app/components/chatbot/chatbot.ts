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

  private readonly MAX_QUESTIONS = 16;
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
    if (text.length > 80) {
      this.addBotMessage('⚠️ Escribí menos de 80 caracteres, por favor.');
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
    if (lower.includes('reserva') || lower.includes('reservar')){ //|| lower.includes('mesa')) {
      this.isTyping = false;
      this.showLimitModal = true;
      return;
    }

    // 1️⃣ Intento de respuesta local
    const localResponse = this.matchLocalIntent(lower);
    if (localResponse) {
      this.addBotMessage(
        `${localResponse} (${this.remainingQuestionsText()})`
      );
      this.isTyping = false;
      return;
    }

    // 2️⃣ Si no hay coincidencia local, usar Gemini
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
      this.addBotMessage(`${data.reply || 'No pude entenderte 🍀'} (${this.remainingQuestionsText()})`);
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

  remainingQuestionsText(): string {
    const remaining = (this.MAX_QUESTIONS - this.userQuestionCount) / 2 + 0.5;
    if (remaining > 0) {
      return `Te quedan ${remaining} pregunta${remaining > 1 ? 's' : ''} 🍀`;
    } else {
      this.showLimitModal = true;
      return 'Ya usaste todas tus preguntas 🍀';
    }
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

    if (this.userQuestionCount >= this.MAX_QUESTIONS) {
      this.addBotMessage('¡Gracias por charlar conmigo! 🍀 Cerrando la sesión...');
      setTimeout(() => {
        window.close(); // intenta cerrar pestaña
        window.location.href = '/'; // fallback a la página principal
      }, 2000);
    } else {
      this.addBotMessage('¡Entendido! 🍀 Si más adelante querés hacer una reserva, estoy acá.');
      this.userQuestionCount = 0;
    }
  }
}
