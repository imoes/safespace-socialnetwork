import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { firstValueFrom } from 'rxjs';

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
    console.log('[WelcomeModal] Component created');

    effect(() => {
      const isAuth = this.authService.isAuthenticated();
      console.log('[WelcomeModal] effect() fired, isAuthenticated:', isAuth);
      if (isAuth) {
        this.checkWelcomeMessage();
      }
    }, { allowSignalWrites: true });
  }

  private async checkWelcomeMessage(): Promise<void> {
    console.log('[WelcomeModal] checkWelcomeMessage() called');
    try {
      const token = localStorage.getItem('access_token');
      console.log('[WelcomeModal] token exists:', !!token);
      if (!token) return;

      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
      console.log('[WelcomeModal] Fetching /api/welcome/message ...');
      const response: any = await firstValueFrom(
        this.http.get('/api/welcome/message', { headers })
      );

      console.log('[WelcomeModal] API response:', JSON.stringify(response));

      if (response.should_show && response.message) {
        console.log('[WelcomeModal] Setting showModal=true');
        this.message.set(response.message);
        this.showModal.set(true);
        console.log('[WelcomeModal] showModal signal value:', this.showModal());
      } else {
        console.log('[WelcomeModal] should_show is false or no message');
      }
    } catch (err) {
      console.error('[WelcomeModal] Error checking welcome message:', err);
    }
  }

  async closeModal(): Promise<void> {
    console.log('[WelcomeModal] closeModal() called');
    try {
      const token = localStorage.getItem('access_token');
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
      await firstValueFrom(
        this.http.post('/api/welcome/message/seen', {}, { headers })
      );
    } catch (err) {
      console.error('[WelcomeModal] Error marking message as seen:', err);
    }

    this.showModal.set(false);
  }
}
