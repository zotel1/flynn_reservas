import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.html',
  styleUrl: './chatbot.css',
})

export class Chatbot implements OnInit {
  messages: Message[] = [];
  isTyping: boolean = false;
  userMessage: string = '';
  messageCount = 0;

  ngOnInit(): void {
      // Mensaje inicial del bot
      this.messages.push({
        id: '1',
        text: '¡Hola, me llamo FlynnBot! 🍀 Estoy aqui para contestar tus preguntas, ¿En qué puedo ayudarte hoy?',
        isBot: true,
        timestamp: new Date()
      });
  }

  sendMessage() {
    const text = this.userMessage.trim();

    if (!text) return;

    if (text.length > 30) {
      this.messages.push({
        id: Date.now().toString(),
        text: '⚠️ Tu mensaje es muy largo. Escribí algo más corto (máx. 30 caracteres).',
        isBot: true,
        timestamp: new Date()
      });
      this.userMessage = '';
      return;
    }

     if (this.messageCount >= 5) {
      this.messages.push({
        id: Date.now().toString(),
        text: 'Ya alcanzaste el límite de 5 preguntas por sesión 😊. Si querés más info, contactanos por WhatsApp 🍀',
        isBot: true,
        timestamp: new Date()
      });
      this.userMessage = '';
      return;
    }

    this.messageCount++;

    
    const userMsg: Message = {
      id: Date.now().toString(),
      text,
      isBot: false,
      timestamp: new Date()
    };

    this.messages.push(userMsg);
    this.userMessage = '';
    this.isTyping = true;
 // Simulación de respuesta (luego se reemplaza por Gemini)
    setTimeout(() => {
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: this.getBotResponse(text),
        isBot: true,
        timestamp: new Date()
      };
      this.messages.push(botMsg);
      this.isTyping = false;
      this.scrollToBottom();
    }, 1200);
  }

  getBotResponse(msg: string): string {
    const lower = msg.toLowerCase();

    if (lower.includes('horario')) {
      return '🕐 Horarios: Mar-Jue 18–02, Vie-Sáb 18–04, Dom 18–00. Cerramos lunes.';
    }
    if (lower.includes('reserva')) {
      return '📞 Podés reservar escribiendo por WhatsApp o desde la web.';
    }
    if (lower.includes('pool')) {
      return '🎱 Tenemos mesas de pool disponibles. ¿Querés reservar una?';
    }
    if (lower.includes('patio')) {
      return '🌿 El patio interno es ideal para disfrutar al aire libre.';
    }

    return 'Puedo ayudarte con horarios, reservas o nuestros sectores (pool, patio, tele). 🍀';
  }

  scrollToBottom() {
    setTimeout(() => {
      const container = document.querySelector('.chat-messages');
      if (container) container.scrollTop = container.scrollHeight;
    });
  }
}