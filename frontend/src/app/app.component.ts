import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from './services/auth.service';
import { UserService, UserSearchResult } from './services/user.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, FormsModule],
  template: `
    @if (authService.isAuthenticated()) {
      <nav class="navbar">
        <a routerLink="/" class="logo">SocialNet</a>

        <div class="search-container">
          <input
            type="text"
            class="search-input"
            placeholder="🔍 Benutzer suchen..."
            [(ngModel)]="searchQuery"
            (input)="onSearchInput()"
            (focus)="showSearchResults.set(true)"
          />
          @if (showSearchResults() && searchResults().length > 0) {
            <div class="search-results">
              @for (user of searchResults(); track user.uid) {
                <div class="search-result-item" (click)="goToProfile(user.uid)">
                  <div class="search-avatar">{{ user.username.charAt(0).toUpperCase() }}</div>
                  <div class="search-user-info">
                    <div class="search-username">{{ user.username }}</div>
                    @if (user.bio) {
                      <div class="search-bio">{{ user.bio }}</div>
                    }
                  </div>
                </div>
              }
            </div>
          }
          @if (showSearchResults() && searchQuery.length >= 2 && searchResults().length === 0) {
            <div class="search-results">
              <div class="no-results">Keine Benutzer gefunden</div>
            </div>
          }
        </div>

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
    .navbar { display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 100; gap: 24px; }
    .logo { font-size: 24px; font-weight: bold; color: #1877f2; text-decoration: none; flex-shrink: 0; }

    .search-container { position: relative; flex: 1; max-width: 500px; }
    .search-input { width: 100%; padding: 10px 16px; border: 1px solid #ddd; border-radius: 20px; font-size: 14px; outline: none; }
    .search-input:focus { border-color: #1877f2; }
    .search-results { position: absolute; top: 100%; left: 0; right: 0; margin-top: 8px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-height: 400px; overflow-y: auto; z-index: 1000; }
    .search-result-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; transition: background 0.2s; }
    .search-result-item:hover { background: #f0f2f5; }
    .search-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #1877f2, #42b72a); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
    .search-user-info { flex: 1; min-width: 0; }
    .search-username { font-weight: 600; font-size: 14px; }
    .search-bio { font-size: 12px; color: #65676b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .no-results { padding: 16px; text-align: center; color: #65676b; font-size: 14px; }

    .nav-right { display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
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
  private userService = inject(UserService);
  private router = inject(Router);

  showDropdown = signal(false);
  showSearchResults = signal(false);
  searchResults = signal<UserSearchResult[]>([]);
  searchQuery = '';
  private searchSubject = new Subject<string>();

  constructor() {
    // Debounced search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length >= 2) {
          return this.userService.searchUsers(query);
        }
        return [];
      })
    ).subscribe(results => {
      this.searchResults.set(results);
    });
  }

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

  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
  }

  goToProfile(uid: number): void {
    this.showSearchResults.set(false);
    this.searchQuery = '';
    this.searchResults.set([]);
    this.router.navigate(['/profile', uid]);
  }
}
