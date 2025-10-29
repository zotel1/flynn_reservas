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
  styleUrls: ['./chatbot.css']
})
export class Chatbot {
  messages: Message[] = [];
  userMessage = '';
  isTyping = false;
  userQuestionCount = 0;
  showLimitModal = false; // modal para límite o palabra clave

  constructor(private router: Router) {}

  ngOnInit() {
    this.messages.push({
      id: '1',
      text: '¡Bienvenido a Flynn Irish Pub! 🍀 Soy tu asistente virtual. Puedo ayudarte con información sobre horarios, eventos, menú o reservas. ¿En qué te gustaría que te ayude hoy?',
      isBot: true,
      timestamp: new Date(),
    });
  }

  async sendMessage() {
  const text = this.userMessage.trim();

  // === VALIDACIONES ===
  if (!text) return;

  if (text.length > 60) {
    this.messages.push({
      id: Date.now().toString(),
      text: '⚠️ Tu mensaje es demasiado largo. Por favor, escribí en menos de 60 caracteres.',
      isBot: true,
      timestamp: new Date(),
    });
    this.userMessage = '';
    return;
  }

  if (this.userQuestionCount >= 6) {
    this.showLimitModal = true;
    return;
  }

  // === AGREGAR MENSAJE DEL USUARIO AL CHAT ===
  const userMsg: Message = {
    id: Date.now().toString(),
    text,
    isBot: false,
    timestamp: new Date(),
  };
  this.messages.push(userMsg);
  this.userMessage = '';
  this.userQuestionCount++;
  this.isTyping = true;

  const lower = text.toLowerCase();

  // === DETECTAR PALABRAS CLAVE DE RESERVA ===
  if (lower.includes('reserva') || lower.includes('reservar') || lower.includes('mesa')) {
    this.isTyping = false;
    this.showLimitModal = true;
    return;
  }

  // === CONSULTAR A GEMINI (API Serverless en Vercel) ===
  try {
    const response = await fetch('https://flynn-reservas.vercel.app/api/gemini.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: this.messages.map(m => ({ text: m.text, isBot: m.isBot })), // <--- HISTORIAL
      }),
    });

    const data = await response.json();

    this.messages.push({
      id: (Date.now() + 1).toString(),
      text: data.reply || 'No pude entenderte, podrías repetirlo 🍀',
      isBot: true,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error al conectar con Gemini:', error);
    this.messages.push({
      id: (Date.now() + 2).toString(),
      text: '⚠️ Ocurrió un error al conectar con el asistente. Intentá más tarde.',
      isBot: true,
      timestamp: new Date(),
    });
  } finally {
    this.isTyping = false;
  }
}
}