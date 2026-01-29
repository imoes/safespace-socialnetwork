import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

interface WelcomeMessage {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

@Component({
  selector: 'app-welcome-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './welcome-modal.component.html',
  styleUrls: ['./welcome-modal.component.css']
})
export class WelcomeModalComponent {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  showModal = signal(false);
  message = signal<WelcomeMessage | null>(null);

  constructor() {
    // Reagiert auf Login/Register — prüft Welcome-Message sobald User authentifiziert ist
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.checkWelcomeMessage();
      }
    });
  }

  private async checkWelcomeMessage(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
      const response: any = await this.http.get('/api/welcome/message', { headers }).toPromise();

      if (response.should_show && response.message) {
        this.message.set(response.message);
        this.showModal.set(true);
      }
    } catch (err) {
      console.error('Error checking welcome message:', err);
    }
  }

  async closeModal(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
      await this.http.post('/api/welcome/message/seen', {}, { headers }).toPromise();
    } catch (err) {
      console.error('Error marking message as seen:', err);
    }

    this.showModal.set(false);
  }
}
