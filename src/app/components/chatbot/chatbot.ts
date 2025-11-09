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

  // === Configuración general ===
  private readonly MAX_QUESTIONS = 10;
  private readonly MAX_CHARACTERS = 150;

  // 🧠 URLs dinámicas: local (ng serve) o Vercel
  private readonly BASE_URL =
  window.location.hostname.includes('localhost')
    ? 'http://localhost:3000'
    : window.location.origin; // <-- clave para Vercel


  private readonly SEARCH_MENU_URL = `${this.BASE_URL}/api/searchMenu`;
  private readonly API_URL = `${this.BASE_URL}/api/gemini`;
  private readonly INSTAGRAM_URL = 'https://www.instagram.com/crissigel/';

  constructor(private router: Router) {}

  // === Inicialización ===
  async ngOnInit() {
    console.log('🤖 [Chatbot] Inicializado');
    console.log('🌍 [Chatbot] BASE_URL:', this.BASE_URL);
    console.log('🔗 [Chatbot] API_URL:', this.API_URL);
    console.log('🔗 [Chatbot] SEARCH_MENU_URL:', this.SEARCH_MENU_URL);
    this.welcomeMessage();
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
    console.log('📝 [Chatbot] Usuario escribió:', text);
    if (!text) return;

    // Reinicio manual
    if (text.toLowerCase().includes('reiniciar') || text.toLowerCase().includes('borrar')) {
      this.welcomeMessage();
      this.userMessage = '';
      console.log('♻️ [Chatbot] Reiniciando conversación...');
      await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'reiniciar' }),
      });
      return;
    }

    // Validaciones
    if (text.length > this.MAX_CHARACTERS) {
      console.warn('⚠️ [Chatbot] Mensaje demasiado largo.');
      this.addBotMessage(`⚠️ Escribí menos de ${this.MAX_CHARACTERS} caracteres, por favor.`);
      this.userMessage = '';
      return;
    }

    if (this.userQuestionCount >= this.MAX_QUESTIONS) {
      console.warn('⚠️ [Chatbot] Límite de preguntas alcanzado.');
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

    console.log('🎯 [Chatbot] Tema detectado:', this.currentTopic);

    // Si menciona reserva → modal
    if (this.currentTopic === 'reservas') {
      this.isTyping = false;
      this.showLimitModal = true;
      return;
    }

    // === Lógica de búsqueda semántica en Qdrant ===
    let semanticContext = '';

    try {
      console.log('🔍 [Chatbot] Enviando búsqueda a Qdrant:', this.SEARCH_MENU_URL);
      const searchRes = await fetch(this.SEARCH_MENU_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });

      console.log('📡 [Chatbot] Status búsqueda:', searchRes.status);

      if (searchRes.ok) {
        const data = await searchRes.json();
        console.log('📦 [Chatbot] Datos recibidos de Qdrant:', data);
        
        if (data.items?.length) {

          const contextItems = data.items
            .map((i: any) => `${i.nombre} - ${i.receta || 'sin descripción'} ($${i.precio})`)
            .join('\n');
          semanticContext = `Resultados del menú más relevantes:\n${contextItems}\n`;
        }
      }else {
        const error = await searchRes.text();
        console.error('❌ [Chatbot] Error Qdrant:', error);
      }
    } catch (err) {
      console.error('⚠️ Error al consultar Qdrant:', err);
    }

    // === Gemini ===
    try {
      const context = `
        Sos Flynn Assistant 🍀, asistente virtual del Flynn Irish Pub.
        Tema actual del usuario: ${this.currentTopic || 'general'}.
        Estos son algunos datos del bar:
        ${semanticContext || 'Sin contexto adicional'}
      `.trim();

      console.log('💬 [Chatbot] Enviando mensaje a Gemini:', {
        url: this.API_URL,
        method: 'POST',
        body: { message: `${context}\nUsuario: ${text}`, history: this.messages },
      });

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `${context}\nUsuario: ${text}`,
          history: this.messages.map((m) => ({ text: m.text, isBot: m.isBot })),
        }),
      });

      console.log('📡 [Chatbot] Status Gemini:', response.status);

      if (!response.ok) {
        const errText = await response.text();
        console.error('❌ [Chatbot] Error de Gemini:', errText);
        this.addBotMessage('⚠️ No pude conectar con el servidor. Intentá más tarde.');
        return;
      }

      const data = await response.json();
      console.log('📦 [Chatbot] Respuesta Gemini:', data);
      this.addBotMessage(data.reply || 'No pude entenderte 🍀');
    } catch (error) {
      console.error('Error al conectar con Gemini:', error);
      this.addBotMessage('⚠️ Error al conectar con el asistente. Intentá más tarde.');
    } finally {
      this.isTyping = false;
    }
  }

  // === Manejo de mensajes ===
  addUserMessage(text: string) {
    console.log('👤 [Chatbot] Usuario envió mensaje:', text);
    this.messages.push({
      id: Date.now().toString(),
      text,
      isBot: false,
      timestamp: new Date(),
    });
  }

  addBotMessage(text: string) {
    console.log('🤖 [Chatbot] Bot responde:', text);
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
