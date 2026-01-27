import { Component, inject, signal, OnInit, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from './services/auth.service';
import { UserService, UserSearchResult } from './services/user.service';
import { I18nService } from './services/i18n.service';
import { TranslatePipe } from './pipes/translate.pipe';
import { WelcomeModalComponent } from './components/welcome-modal/welcome-modal.component';
import { NotificationsDropdownComponent } from './components/notifications-dropdown/notifications-dropdown.component';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, interval, filter } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, FormsModule, WelcomeModalComponent, NotificationsDropdownComponent, TranslatePipe],
  template: `
    @if (authService.isAuthenticated()) {
      <nav class="navbar">
        <a routerLink="/" class="logo">{{ siteTitle() }}</a>

        <div class="search-container desktop-only">
          <input
            type="text"
            class="search-input"
            [placeholder]="'🔍 ' + ('nav.searchPlaceholder' | translate)"
            [(ngModel)]="searchQuery"
            (input)="onSearchInput()"
            (focus)="onSearchFocus()"
            (keydown)="onSearchKeydown($event)"
          />
          @if (showSearchResults() && searchResults().length > 0) {
            <div class="search-overlay" (click)="closeSearch()"></div>
            <div class="search-results">
              @for (user of searchResults(); track user.uid; let i = $index) {
                <div
                  class="search-result-item"
                  [class.selected]="selectedIndex() === i"
                  (click)="goToProfile(user.uid)"
                  (mouseenter)="selectedIndex.set(i)"
                >
                  @if (user.profile_picture) {
                    <img [src]="user.profile_picture" class="search-avatar search-avatar-img" [alt]="user.username" />
                  } @else {
                    <div class="search-avatar">{{ user.username.charAt(0).toUpperCase() }}</div>
                  }
                  <div class="search-user-info">
                    <div class="search-username">
                      {{ user.username }}
                      @if (user.is_friend) {
                        <span class="friend-badge">✓ {{ 'friends.title' | translate }}</span>
                      }
                    </div>
                    @if (user.bio) {
                      <div class="search-bio">{{ user.bio }}</div>
                    }
                  </div>
                </div>
              }
            </div>
          }
          @if (showSearchResults() && searchQuery.length >= 2 && searchResults().length === 0) {
            <div class="search-overlay" (click)="closeSearch()"></div>
            <div class="search-results">
              <div class="no-results">{{ 'common.noResults' | translate }}</div>
            </div>
          }
        </div>

        <!-- Desktop navigation -->
        <div class="nav-right desktop-only">
          @if (!authService.isModerator() && !authService.isAdmin()) {
            <a routerLink="/" class="nav-link">🏠 {{ 'nav.feed' | translate }}</a>
            <a routerLink="/my-posts" class="nav-link">📝 {{ 'nav.myPosts' | translate }}</a>
            <a routerLink="/public-feed" class="nav-link">🌍 {{ 'nav.public' | translate }}</a>
            <a routerLink="/hashtags" class="nav-link">🏷️ {{ 'nav.hashtags' | translate }}</a>
            <a routerLink="/friends" class="nav-link nav-link-with-badge">
              👫 {{ 'nav.friends' | translate }}
              @if (pendingRequestsCount() > 0) {
                <span class="notification-badge">{{ pendingRequestsCount() }}</span>
              }
            </a>
            <a routerLink="/groups" class="nav-link">👥 {{ 'nav.groups' | translate }}</a>
          }
          <app-notifications-dropdown />
          @if (authService.isModerator()) {
            <a routerLink="/admin" class="nav-link nav-link-with-badge">
              🛡️ {{ 'nav.moderation' | translate }}
              @if (openReportsCount() > 0) {
                <span class="notification-badge">{{ openReportsCount() }}</span>
              }
            </a>
          }
          @if (authService.isAdmin()) {
            <a routerLink="/admin-panel" class="nav-link nav-link-with-badge">
              👑 Admin
              @if (openReportsCount() > 0) {
                <span class="notification-badge">{{ openReportsCount() }}</span>
              }
            </a>
            <a routerLink="/users" class="nav-link">👥 {{ 'nav.users' | translate }}</a>
          }

          <div class="user-menu">
            <button class="user-button" (click)="toggleDropdown()">
              {{ authService.currentUser()?.username }}
              <span class="dropdown-arrow">▼</span>
            </button>

            @if (showDropdown()) {
              <div class="dropdown-overlay" (click)="closeDropdown()"></div>
              <div class="dropdown-menu">
                <a routerLink="/settings" class="dropdown-item" (click)="closeDropdown()">
                  ⚙️ {{ 'nav.settings' | translate }}
                </a>
                <div class="dropdown-divider"></div>
                <a routerLink="/info" class="dropdown-item" (click)="closeDropdown()">
                  ℹ️ {{ 'nav.info' | translate }}
                </a>
                <a routerLink="/privacy-policy" class="dropdown-item" (click)="closeDropdown()">
                  📜 {{ 'nav.privacyPolicy' | translate }}
                </a>
                <a routerLink="/impressum" class="dropdown-item" (click)="closeDropdown()">
                  ⚖️ {{ 'nav.impressum' | translate }}
                </a>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item logout-item" (click)="logout()">
                  🚪 {{ 'nav.logout' | translate }}
                </button>
              </div>
            }
          </div>
        </div>

        <!-- Mobile: notifications + hamburger -->
        <div class="mobile-nav-buttons mobile-only">
          <app-notifications-dropdown />
          <button class="hamburger-btn" (click)="toggleMobileMenu()" [attr.aria-label]="'Menu'">
            <span class="hamburger-line" [class.open]="showMobileMenu()"></span>
            <span class="hamburger-line" [class.open]="showMobileMenu()"></span>
            <span class="hamburger-line" [class.open]="showMobileMenu()"></span>
          </button>
        </div>
      </nav>

      <!-- Mobile menu overlay -->
      @if (showMobileMenu()) {
        <div class="mobile-menu-overlay" (click)="closeMobileMenu()"></div>
        <div class="mobile-menu" [class.open]="showMobileMenu()">
          <!-- Mobile search -->
          <div class="mobile-search-container">
            <input
              type="text"
              class="search-input mobile-search-input"
              [placeholder]="'🔍 ' + ('nav.searchPlaceholder' | translate)"
              [(ngModel)]="mobileSearchQuery"
              (input)="onMobileSearchInput()"
              (keydown)="onMobileSearchKeydown($event)"
            />
            @if (mobileSearchResults().length > 0) {
              <div class="mobile-search-results">
                @for (user of mobileSearchResults(); track user.uid) {
                  <div class="search-result-item" (click)="goToProfileMobile(user.uid)">
                    @if (user.profile_picture) {
                      <img [src]="user.profile_picture" class="search-avatar search-avatar-img" [alt]="user.username" />
                    } @else {
                      <div class="search-avatar">{{ user.username.charAt(0).toUpperCase() }}</div>
                    }
                    <div class="search-user-info">
                      <div class="search-username">{{ user.username }}</div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <div class="mobile-menu-user">
            <div class="mobile-user-avatar">{{ authService.currentUser()?.username?.charAt(0)?.toUpperCase() }}</div>
            <div class="mobile-user-name">{{ authService.currentUser()?.username }}</div>
          </div>

          <div class="mobile-menu-section">
            @if (!authService.isModerator() && !authService.isAdmin()) {
              <a routerLink="/" class="mobile-menu-item" (click)="closeMobileMenu()">🏠 {{ 'nav.feed' | translate }}</a>
              <a routerLink="/my-posts" class="mobile-menu-item" (click)="closeMobileMenu()">📝 {{ 'nav.myPosts' | translate }}</a>
              <a routerLink="/public-feed" class="mobile-menu-item" (click)="closeMobileMenu()">🌍 {{ 'nav.public' | translate }}</a>
              <a routerLink="/hashtags" class="mobile-menu-item" (click)="closeMobileMenu()">🏷️ {{ 'nav.hashtags' | translate }}</a>
              <a routerLink="/friends" class="mobile-menu-item" (click)="closeMobileMenu()">
                👫 {{ 'nav.friends' | translate }}
                @if (pendingRequestsCount() > 0) {
                  <span class="mobile-badge">{{ pendingRequestsCount() }}</span>
                }
              </a>
              <a routerLink="/groups" class="mobile-menu-item" (click)="closeMobileMenu()">👥 {{ 'nav.groups' | translate }}</a>
            }
            @if (authService.isModerator()) {
              <a routerLink="/admin" class="mobile-menu-item" (click)="closeMobileMenu()">
                🛡️ {{ 'nav.moderation' | translate }}
                @if (openReportsCount() > 0) {
                  <span class="mobile-badge">{{ openReportsCount() }}</span>
                }
              </a>
            }
            @if (authService.isAdmin()) {
              <a routerLink="/admin-panel" class="mobile-menu-item" (click)="closeMobileMenu()">
                👑 Admin
                @if (openReportsCount() > 0) {
                  <span class="mobile-badge">{{ openReportsCount() }}</span>
                }
              </a>
              <a routerLink="/users" class="mobile-menu-item" (click)="closeMobileMenu()">👥 {{ 'nav.users' | translate }}</a>
            }
          </div>

          <div class="mobile-menu-divider"></div>

          <div class="mobile-menu-section">
            <div class="mobile-section-title">{{ 'nav.settings' | translate }}</div>
            <a routerLink="/settings" class="mobile-menu-item" (click)="closeMobileMenu()">⚙️ {{ 'nav.settings' | translate }}</a>
            <a routerLink="/info" class="mobile-menu-item" (click)="closeMobileMenu()">ℹ️ {{ 'nav.info' | translate }}</a>
            <a routerLink="/privacy-policy" class="mobile-menu-item" (click)="closeMobileMenu()">📜 {{ 'nav.privacyPolicy' | translate }}</a>
            <a routerLink="/impressum" class="mobile-menu-item" (click)="closeMobileMenu()">⚖️ {{ 'nav.impressum' | translate }}</a>
          </div>

          <div class="mobile-menu-divider"></div>

          <div class="mobile-menu-section">
            <button class="mobile-menu-item mobile-logout" (click)="mobileLogout()">🚪 {{ 'nav.logout' | translate }}</button>
          </div>
        </div>
      }
    }
    <router-outlet />
    <app-welcome-modal />
  `,
  styles: [`
    /* === Navbar base === */
    .navbar { display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 100; gap: 24px; }
    .logo { font-size: 24px; font-weight: bold; color: #1877f2; text-decoration: none; flex-shrink: 0; }

    /* === Search === */
    .search-container { position: relative; flex: 1; max-width: 500px; }
    .search-input { width: 100%; padding: 10px 16px; border: 1px solid #ddd; border-radius: 20px; font-size: 14px; outline: none; box-sizing: border-box; }
    .search-input:focus { border-color: #1877f2; }
    .search-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999; }
    .search-results { position: absolute; top: 100%; left: 0; right: 0; margin-top: 8px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-height: 400px; overflow-y: auto; z-index: 1000; }
    .search-result-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; transition: background 0.2s; }
    .search-result-item:hover, .search-result-item.selected { background: #f0f2f5; }
    .search-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #1877f2, #42b72a); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
    .search-avatar-img { object-fit: cover; }
    .search-user-info { flex: 1; min-width: 0; }
    .search-username { font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px; }
    .friend-badge { background: #27ae60; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; font-weight: 500; }
    .search-bio { font-size: 12px; color: #65676b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .no-results { padding: 16px; text-align: center; color: #65676b; font-size: 14px; }

    /* === Desktop nav === */
    .nav-right { display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
    .nav-link { color: #666; text-decoration: none; padding: 8px 12px; border-radius: 6px; transition: background 0.2s; white-space: nowrap; }
    .nav-link:hover { background: #f0f2f5; }
    .nav-link-with-badge { position: relative; display: inline-block; }
    .notification-badge {
      position: absolute;
      top: -5px;
      right: -10px;
      background: #e74c3c;
      color: white;
      border-radius: 10px;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: bold;
      min-width: 18px;
      text-align: center;
      line-height: 14px;
      z-index: 10;
    }

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
      min-width: 240px;
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

    /* === Mobile hamburger button === */
    .mobile-nav-buttons {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .hamburger-btn {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 5px;
      width: 40px;
      height: 40px;
      background: #f0f2f5;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      padding: 8px;
      transition: background 0.2s;
    }
    .hamburger-btn:hover { background: #e4e6e9; }

    .hamburger-line {
      display: block;
      width: 22px;
      height: 2px;
      background: #333;
      border-radius: 2px;
      transition: transform 0.3s, opacity 0.3s;
    }
    .hamburger-line.open:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    .hamburger-line.open:nth-child(2) { opacity: 0; }
    .hamburger-line.open:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

    /* === Mobile menu overlay === */
    .mobile-menu-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 200;
      animation: fadeIn 0.2s ease;
    }

    /* === Mobile slide-in menu === */
    .mobile-menu {
      position: fixed;
      top: 0;
      right: 0;
      width: 300px;
      max-width: 85vw;
      height: 100vh;
      background: white;
      z-index: 300;
      overflow-y: auto;
      padding: 20px 0;
      box-shadow: -4px 0 20px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* === Mobile search === */
    .mobile-search-container {
      padding: 0 16px 12px;
    }
    .mobile-search-input {
      width: 100%;
      font-size: 15px;
    }
    .mobile-search-results {
      margin-top: 4px;
      border: 1px solid #e4e6e9;
      border-radius: 8px;
      max-height: 200px;
      overflow-y: auto;
    }

    /* === Mobile menu content === */
    .mobile-menu-user {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px 16px;
      border-bottom: 1px solid #e4e6e9;
      margin-bottom: 8px;
    }
    .mobile-user-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1877f2, #42b72a);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 18px;
      flex-shrink: 0;
    }
    .mobile-user-name {
      font-weight: 600;
      font-size: 16px;
      color: #1c1e21;
    }

    .mobile-menu-section {
      padding: 4px 0;
    }
    .mobile-section-title {
      padding: 8px 20px 4px;
      font-size: 12px;
      font-weight: 600;
      color: #65676b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .mobile-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 12px 20px;
      color: #1c1e21;
      text-decoration: none;
      font-size: 15px;
      border: none;
      background: none;
      cursor: pointer;
      transition: background 0.2s;
      text-align: left;
    }
    .mobile-menu-item:hover, .mobile-menu-item:active { background: #f0f2f5; }

    .mobile-badge {
      background: #e74c3c;
      color: white;
      border-radius: 10px;
      padding: 2px 8px;
      font-size: 12px;
      font-weight: bold;
      margin-left: auto;
    }

    .mobile-menu-divider {
      height: 1px;
      background: #e4e6e9;
      margin: 8px 16px;
    }

    .mobile-logout {
      color: #e74c3c;
      font-weight: 500;
    }

    /* === Responsive visibility === */
    .mobile-only { display: none; }

    @media (max-width: 1024px) {
      .desktop-only { display: none !important; }
      .mobile-only { display: flex !important; }

      .navbar {
        padding: 10px 16px;
        gap: 12px;
      }
      .logo { font-size: 20px; }
    }
  `]
})
export class AppComponent implements OnInit {
  authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);
  private http = inject(HttpClient);

  siteTitle = signal('SocialNet');
  showDropdown = signal(false);
  showSearchResults = signal(false);
  searchResults = signal<UserSearchResult[]>([]);
  selectedIndex = signal(-1);
  pendingRequestsCount = signal(0);
  openReportsCount = signal(0);
  searchQuery = '';
  private searchSubject = new Subject<string>();

  // Mobile menu
  showMobileMenu = signal(false);
  mobileSearchQuery = '';
  mobileSearchResults = signal<UserSearchResult[]>([]);
  private mobileSearchSubject = new Subject<string>();

  constructor() {
    // Debounced search (desktop)
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length >= 2) {
          return this.userService.searchUsers(query);
        }
        return of([]);
      })
    ).subscribe(results => {
      this.searchResults.set(results);
    });

    // Debounced search (mobile)
    this.mobileSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length >= 2) {
          return this.userService.searchUsers(query);
        }
        return of([]);
      })
    ).subscribe(results => {
      this.mobileSearchResults.set(results);
    });

    // Close mobile menu on navigation
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.closeMobileMenu();
    });

    // Watch for authentication changes and load pending requests
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.loadPendingRequestsCount();

        // Reports für Admins und Moderatoren laden
        if (this.authService.isAdmin() || this.authService.isModerator()) {
          this.loadOpenReportsCount();
        }
      }
    });
  }

  ngOnInit(): void {
    this.loadSiteTitle();

    // Refresh pending requests count every 30 seconds
    interval(30000).subscribe(() => {
      if (this.authService.isAuthenticated()) {
        this.loadPendingRequestsCount();

        // Reports für Admins und Moderatoren laden
        if (this.authService.isAdmin() || this.authService.isModerator()) {
          this.loadOpenReportsCount();
        }
      }
    });
  }

  private loadSiteTitle(): void {
    this.http.get<{ site_title: string }>('/api/admin/public/site-title').subscribe({
      next: (response) => {
        if (response.site_title) {
          this.siteTitle.set(response.site_title);
        }
      },
      error: () => {}
    });
  }

  private loadPendingRequestsCount(): void {
    this.http.get<{ requests: any[] }>('/api/friends/requests').subscribe({
      next: (response) => {
        this.pendingRequestsCount.set(response.requests.length);
      },
      error: () => {}
    });
  }

  private loadOpenReportsCount(): void {
    this.http.get<{ reports: any[] }>('/api/admin/reports', {
      params: { limit: '1000' }
    }).subscribe({
      next: (response) => {
        this.openReportsCount.set(response.reports.length);
      },
      error: () => {}
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
    this.selectedIndex.set(-1);
    // Ergebnisse wieder anzeigen wenn User tippt
    if (this.searchQuery.length >= 2) {
      this.showSearchResults.set(true);
    }
  }

  onSearchFocus(): void {
    this.showSearchResults.set(true);
    if (this.searchQuery.length >= 2) {
      this.searchSubject.next(this.searchQuery);
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const results = this.searchResults();

    if (event.key === 'Escape') {
      this.closeSearch();
      return;
    }

    if (results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex.update(i => (i + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex.update(i => (i - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const index = this.selectedIndex();
      if (index >= 0 && index < results.length) {
        this.goToProfile(results[index].uid);
      }
    }
  }

  closeSearch(): void {
    this.showSearchResults.set(false);
    this.selectedIndex.set(-1);
  }

  goToProfile(uid: number): void {
    this.closeSearch();
    this.searchQuery = '';
    this.searchResults.set([]);
    this.router.navigate(['/profile', uid]);
  }

  // === Mobile menu methods ===

  toggleMobileMenu(): void {
    this.showMobileMenu.update(v => !v);
    if (!this.showMobileMenu()) {
      this.resetMobileSearch();
    }
  }

  closeMobileMenu(): void {
    this.showMobileMenu.set(false);
    this.resetMobileSearch();
  }

  mobileLogout(): void {
    this.closeMobileMenu();
    this.authService.logout();
  }

  onMobileSearchInput(): void {
    this.mobileSearchSubject.next(this.mobileSearchQuery);
    if (this.mobileSearchQuery.length < 2) {
      this.mobileSearchResults.set([]);
    }
  }

  onMobileSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.resetMobileSearch();
    }
  }

  goToProfileMobile(uid: number): void {
    this.closeMobileMenu();
    this.router.navigate(['/profile', uid]);
  }

  private resetMobileSearch(): void {
    this.mobileSearchQuery = '';
    this.mobileSearchResults.set([]);
  }
}
