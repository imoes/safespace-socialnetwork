import { Component, inject, signal } from '@angular/core';
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
          @if (authService.isModerator()) {
            <a routerLink="/admin" class="nav-link">🛡️ Moderation</a>
          }
          @if (authService.isAdmin()) {
            <a routerLink="/users" class="nav-link">👥 Benutzer</a>
          }
          <a routerLink="/friends" class="nav-link">👫 Freunde</a>

          <div class="user-menu">
            <button class="user-button" (click)="toggleDropdown()">
              {{ authService.currentUser()?.username }}
              <span class="dropdown-arrow">▼</span>
            </button>

            @if (showDropdown()) {
              <div class="dropdown-overlay" (click)="closeDropdown()"></div>
              <div class="dropdown-menu">
                <a routerLink="/settings" class="dropdown-item" (click)="closeDropdown()">
                  ⚙️ Einstellungen
                </a>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item logout-item" (click)="logout()">
                  🚪 Abmelden
                </button>
              </div>
            }
          </div>
        </div>
      </nav>
    }
    <router-outlet />
  `,
  styles: [`
    .navbar { display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 100; }
    .logo { font-size: 24px; font-weight: bold; color: #1877f2; text-decoration: none; }
    .nav-right { display: flex; align-items: center; gap: 16px; }
    .nav-link { color: #666; text-decoration: none; padding: 8px 12px; border-radius: 6px; transition: background 0.2s; }
    .nav-link:hover { background: #f0f2f5; }

    .user-menu { position: relative; }
    .user-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: #f0f2f5;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      color: #666;
      font-weight: 500;
      transition: background 0.2s;
    }
    .user-button:hover { background: #e4e6e9; }
    .dropdown-arrow { font-size: 10px; }

    .dropdown-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 999;
    }

    .dropdown-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 8px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 200px;
      padding: 8px 0;
      z-index: 1000;
    }

    .dropdown-item {
      display: block;
      width: 100%;
      padding: 10px 16px;
      border: none;
      background: none;
      text-align: left;
      color: #333;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.2s;
    }
    .dropdown-item:hover { background: #f0f2f5; }

    .dropdown-divider {
      height: 1px;
      background: #e4e6e9;
      margin: 8px 0;
    }

    .logout-item {
      color: #e74c3c;
    }
  `]
})
export class AppComponent {
  authService = inject(AuthService);
  showDropdown = signal(false);

  toggleDropdown(): void {
    this.showDropdown.update(v => !v);
  }

  closeDropdown(): void {
    this.showDropdown.set(false);
  }

  logout(): void {
    this.closeDropdown();
    this.authService.logout();
  }
}
