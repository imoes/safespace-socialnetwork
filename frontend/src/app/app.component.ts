import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  template: `
    @if (authService.isAuthenticated()) {
      <nav class="navbar">
        <a routerLink="/" class="logo">SocialNet</a>
        <div class="nav-right">
          <a routerLink="/" class="nav-link">🏠 Feed</a>
          <a routerLink="/admin" class="nav-link">🛡️ Moderation</a>
          <span class="username">{{ authService.currentUser()?.username }}</span>
          <button (click)="logout()">Abmelden</button>
        </div>
      </nav>
    }
    <router-outlet />
  `,
  styles: [`
    .navbar { display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 100; }
    .logo { font-size: 24px; font-weight: bold; color: #1877f2; text-decoration: none; }
    .nav-right { display: flex; align-items: center; gap: 16px; }
    .nav-link { color: #666; text-decoration: none; padding: 8px 12px; border-radius: 6px; }
    .nav-link:hover { background: #f0f2f5; }
    .username { color: #666; }
    button { padding: 8px 16px; background: #f0f2f5; border: none; border-radius: 6px; cursor: pointer; }
    button:hover { background: #e4e6e9; }
  `]
})
export class AppComponent {
  authService = inject(AuthService);
  logout(): void { this.authService.logout(); }
}
