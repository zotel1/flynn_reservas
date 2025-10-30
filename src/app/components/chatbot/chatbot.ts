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

  // Detectar automáticamente entorno (local o producción)
  private readonly API_URL =
    window.location.hostname === 'localhost'
      ? 'http://localhost:4000/api/gemini'
      : '/api/gemini';

  constructor(private router: Router) {}

  ngOnInit() {
    this.welcomeMessage();
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
    if (text.length > 60) {
      this.addBotMessage('⚠️ Escribí menos de 60 caracteres, por favor.');
      this.userMessage = '';
      return;
    }

    if (this.userQuestionCount >= 6) {
      this.showLimitModal = true;
      return;
    }

    // Agregar mensaje del usuario
    this.addUserMessage(text);
    this.userMessage = '';
    this.userQuestionCount++;
    this.isTyping = true;

    // Si menciona reservas, abre modal
    const lower = text.toLowerCase();
    if (lower.includes('reserva') || lower.includes('reservar') || lower.includes('mesa')) {
      this.isTyping = false;
      this.showLimitModal = true;
      return;
    }

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: this.messages.map((m) => ({ text: m.text, isBot: m.isBot })),
        }),
      });

      // Previene errores si el backend responde vacío o lento
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

  // === Utilidades ===
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
    this.addBotMessage('¡Entendido! 🍀 Si más adelante querés hacer una reserva, estoy acá.');
    this.userQuestionCount = 0;
  }
}
