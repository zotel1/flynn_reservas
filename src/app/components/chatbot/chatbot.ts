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

  sendMessage() {
    const text = this.userMessage.trim();
    if (!text) return;

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
    if (
      lower.includes('reserva') ||
      lower.includes('reservar') ||
      lower.includes('mesa')
    ) {
      this.isTyping = false;
      this.showLimitModal = true; // mostramos modal, no redirigimos directo
      return;
    }

    // === LÍMITE DE CONSULTAS ===
    if (this.userQuestionCount > 5) {
      this.isTyping = false;
      this.showLimitModal = true;
      return;
    }

    // === RESPUESTA AUTOMÁTICA ===
    setTimeout(() => {
      const botResponse = this.getBotResponse(text);
      this.messages.push({
        id: (Date.now() + 1).toString(),
        text: botResponse,
        isBot: true,
        timestamp: new Date(),
      });
      this.isTyping = false;
    }, 1000);
  }

  getBotResponse(msg: string): string {
    const lower = msg.toLowerCase();

    if (lower.includes('horario') || lower.includes('hora'))
      return 'Estamos abiertos de martes a domingo 🍀. Mar-Jue 18:00–02:00, Vie-Sáb 18:00–04:00 y Dom 18:00–00:00.';
    if (lower.includes('menú') || lower.includes('menu'))
      return 'Nuestro menú incluye auténtica comida irlandesa 🍺: Fish & Chips, Irish Stew, Shepherd’s Pie y más.';
    if (lower.includes('evento') || lower.includes('música'))
      return '🎶 Tenemos música en vivo los fines de semana y noches especiales. ¡El ambiente es único!';
    if (lower.includes('pool') || lower.includes('billar'))
      return '🎱 Contamos con mesas de pool en un ambiente relajado. Ideal para grupos y amigos.';
    return 'Puedo ayudarte con horarios, menú, eventos o reservas. ¿Qué te gustaría saber?';
  }

  // === ACCIONES DEL MODAL ===
  onConfirmReserve() {
    this.showLimitModal = false;
    this.router.navigate(['/reservas']);
  }

  onDeclineReserve() {
    this.showLimitModal = false;
    this.messages.push({
      id: Date.now().toString(),
      text: '¡Entendido! 🍀 Si más adelante querés hacer una reserva, estaré aquí para ayudarte.',
      isBot: true,
      timestamp: new Date(),
    });
    this.userQuestionCount = 0;
  }
}
