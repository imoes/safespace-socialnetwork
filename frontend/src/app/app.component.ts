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
import { ScreenTimeModalComponent } from './components/screen-time-modal/screen-time-modal.component';
import { CookieConsentComponent } from './components/cookie-consent/cookie-consent.component';
import { ScreenTimeService } from './services/screen-time.service';
import { SeoService } from './services/seo.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, interval, filter } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, FormsModule, WelcomeModalComponent, NotificationsDropdownComponent, ScreenTimeModalComponent, CookieConsentComponent, TranslatePipe],
  template: `
    @if (authService.isAuthenticated()) {
      <nav class="navbar">
        <!-- Left section: Logo + Search -->
        <div class="nav-left">
          <a routerLink="/" class="logo">{{ siteTitle() }}</a>
          <div class="search-container desktop-only">
            <input
              type="text"
              class="search-input"
              [placeholder]="'nav.searchPlaceholder' | translate"
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
                          <span class="friend-badge">{{ 'friends.title' | translate }}</span>
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
        </div>

        <!-- Center section: Icon navigation tabs -->
        <div class="nav-center desktop-only">
          @if (!authService.isModerator() && !authService.isAdmin()) {
            <a routerLink="/" class="nav-tab" [class.active]="isRouteActive('/')" [title]="'nav.feed' | translate">
              <svg viewBox="0 0 24 24" class="nav-icon"><path d="M9.464 3.596L4.298 7.836C3.49 8.472 3 9.462 3 10.516V18a3 3 0 003 3h2.5a1.5 1.5 0 001.5-1.5V16a2 2 0 014 0v3.5a1.5 1.5 0 001.5 1.5H18a3 3 0 003-3v-7.484c0-1.054-.49-2.044-1.298-2.68l-5.166-4.24a3.001 3.001 0 00-4.072 0z"/></svg>
            </a>
            <a routerLink="/friends" class="nav-tab" [class.active]="isRouteActive('/friends')" [title]="'nav.friends' | translate">
              <svg viewBox="0 0 24 24" class="nav-icon"><path d="M12.5 9a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm-7 3a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm14 0a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM7 14.25c-2.5 0-4.5 1.5-4.5 3.75v1.5c0 .83.67 1.5 1.5 1.5h6c.83 0 1.5-.67 1.5-1.5V18c0-2.25-2-3.75-4.5-3.75zm5.5 0c-2.5 0-4.5 1.5-4.5 3.75v1.5c0 .83.67 1.5 1.5 1.5h6c.83 0 1.5-.67 1.5-1.5V18c0-2.25-2-3.75-4.5-3.75zm7 0c-2.5 0-4.5 1.5-4.5 3.75v1.5c0 .83.67 1.5 1.5 1.5h6c.83 0 1.5-.67 1.5-1.5V18c0-2.25-2-3.75-4.5-3.75z"/></svg>
              @if (pendingRequestsCount() > 0) {
                <span class="nav-tab-badge">{{ pendingRequestsCount() }}</span>
              }
            </a>
            <a routerLink="/public-feed" class="nav-tab" [class.active]="isRouteActive('/public-feed')" [title]="'nav.public' | translate">
              <svg viewBox="0 0 24 24" class="nav-icon"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            </a>
            <a routerLink="/groups" class="nav-tab" [class.active]="isRouteActive('/groups')" [title]="'nav.groups' | translate">
              <svg viewBox="0 0 24 24" class="nav-icon"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            </a>
            <a routerLink="/hashtags" class="nav-tab" [class.active]="isRouteActive('/hashtags')" [title]="'nav.hashtags' | translate">
              <svg viewBox="0 0 24 24" class="nav-icon"><path d="M20 10V8h-4V4h-2v4h-4V4H8v4H4v2h4v4H4v2h4v4h2v-4h4v4h2v-4h4v-2h-4v-4h4zm-6 4h-4v-4h4v4z"/></svg>
            </a>
          }
          @if (authService.isModerator()) {
            <a routerLink="/admin" class="nav-tab" [class.active]="isRouteActive('/admin')" [title]="'nav.moderation' | translate">
              <svg viewBox="0 0 24 24" class="nav-icon"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
              @if (openReportsCount() > 0) {
                <span class="nav-tab-badge">{{ openReportsCount() }}</span>
              }
            </a>
          }
          @if (authService.isAdmin()) {
            <a routerLink="/admin-panel" class="nav-tab" [class.active]="isRouteActive('/admin-panel')" [title]="'Admin'">
              <svg viewBox="0 0 24 24" class="nav-icon"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
              @if (openReportsCount() > 0) {
                <span class="nav-tab-badge">{{ openReportsCount() }}</span>
              }
            </a>
            <a routerLink="/users" class="nav-tab" [class.active]="isRouteActive('/users')" [title]="'nav.users' | translate">
              <svg viewBox="0 0 24 24" class="nav-icon"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
            </a>
          }
        </div>

        <!-- Right section: Actions -->
        <div class="nav-right desktop-only">
          <app-notifications-dropdown />
          <div class="user-menu">
            <button class="user-button" (click)="toggleDropdown()">
              @if (authService.currentUser()?.profile_picture) {
                <img [src]="authService.currentUser()?.profile_picture" class="user-avatar-img" [alt]="authService.currentUser()?.username" />
              } @else {
                <div class="user-avatar-small">{{ authService.currentUser()?.username?.charAt(0)?.toUpperCase() }}</div>
              }
              <span class="user-name-text">{{ authService.currentUser()?.username }}</span>
            </button>

            @if (showDropdown()) {
              <div class="dropdown-overlay" (click)="closeDropdown()"></div>
              <div class="dropdown-menu">
                <a [routerLink]="['/profile', authService.currentUser()?.uid]" class="dropdown-item dropdown-profile" (click)="closeDropdown()">
                  @if (authService.currentUser()?.profile_picture) {
                    <img [src]="authService.currentUser()?.profile_picture" class="dropdown-avatar-img" />
                  } @else {
                    <div class="dropdown-avatar">{{ authService.currentUser()?.username?.charAt(0)?.toUpperCase() }}</div>
                  }
                  <span class="dropdown-profile-name">{{ authService.currentUser()?.username }}</span>
                </a>
                <div class="dropdown-divider"></div>
                <a routerLink="/settings" class="dropdown-item" (click)="closeDropdown()">
                  <span class="dropdown-icon-circle">⚙️</span> {{ 'nav.settings' | translate }}
                </a>
                <a routerLink="/my-posts" class="dropdown-item" (click)="closeDropdown()">
                  <span class="dropdown-icon-circle">📝</span> {{ 'nav.myPosts' | translate }}
                </a>
                <a href="https://github.com/sponsors/imoes" target="_blank" rel="noopener noreferrer" class="dropdown-item" (click)="closeDropdown()">
                  <span class="dropdown-icon-circle">❤️</span> {{ 'nav.donate' | translate }}
                </a>
                <div class="dropdown-divider"></div>
                <a routerLink="/info" class="dropdown-item" (click)="closeDropdown()">
                  <span class="dropdown-icon-circle">ℹ️</span> {{ 'nav.info' | translate }}
                </a>
                <a routerLink="/privacy-policy" class="dropdown-item" (click)="closeDropdown()">
                  <span class="dropdown-icon-circle">📜</span> {{ 'nav.privacyPolicy' | translate }}
                </a>
                <a routerLink="/impressum" class="dropdown-item" (click)="closeDropdown()">
                  <span class="dropdown-icon-circle">⚖️</span> {{ 'nav.impressum' | translate }}
                </a>
                <a routerLink="/terms" class="dropdown-item" (click)="closeDropdown()">
                  <span class="dropdown-icon-circle">📋</span> {{ 'nav.terms' | translate }}
                </a>
                <a routerLink="/community-guidelines" class="dropdown-item" (click)="closeDropdown()">
                  <span class="dropdown-icon-circle">🤝</span> {{ 'nav.communityGuidelines' | translate }}
                </a>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item logout-item" (click)="logout()">
                  <span class="dropdown-icon-circle">🚪</span> {{ 'nav.logout' | translate }}
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
              [placeholder]="'nav.searchPlaceholder' | translate"
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
            <a routerLink="/terms" class="mobile-menu-item" (click)="closeMobileMenu()">📋 {{ 'nav.terms' | translate }}</a>
            <a routerLink="/community-guidelines" class="mobile-menu-item" (click)="closeMobileMenu()">🤝 {{ 'nav.communityGuidelines' | translate }}</a>
            <a href="https://github.com/sponsors/imoes" target="_blank" rel="noopener noreferrer" class="mobile-menu-item" (click)="closeMobileMenu()">❤️ {{ 'nav.donate' | translate }}</a>
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
    <app-screen-time-modal />
    <app-cookie-consent />
  `,
  styles: [`
    /* === Navbar base (Facebook-style 3-section layout) === */
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 16px;
      height: 56px;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    /* Left section: logo + search */
    .nav-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
      min-width: 0;
    }
    .logo {
      font-size: 28px;
      font-weight: 800;
      color: #1877f2;
      text-decoration: none;
      flex-shrink: 0;
      letter-spacing: -0.5px;
    }

    /* === Search === */
    .search-container { position: relative; }
    .search-input {
      width: 240px;
      padding: 8px 16px;
      border: none;
      border-radius: 50px;
      font-size: 14px;
      outline: none;
      box-sizing: border-box;
      background: #f0f2f5;
      transition: width 0.3s;
    }
    .search-input:focus { width: 280px; background: white; box-shadow: 0 0 0 2px #1877f2; }
    .search-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999; }
    .search-results { position: absolute; top: calc(100% + 8px); left: 0; width: 320px; background: white; border-radius: 8px; box-shadow: 0 12px 28px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.05); max-height: 480px; overflow-y: auto; z-index: 1000; }
    .search-result-item { display: flex; align-items: center; gap: 12px; padding: 8px 16px; cursor: pointer; transition: background 0.15s; }
    .search-result-item:hover, .search-result-item.selected { background: #f0f2f5; }
    .search-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #1877f2, #42b72a); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0; }
    .search-avatar-img { object-fit: cover; }
    .search-user-info { flex: 1; min-width: 0; }
    .search-username { font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px; }
    .friend-badge { background: #e7f3ff; color: #1877f2; font-size: 10px; padding: 2px 6px; border-radius: 10px; font-weight: 600; }
    .search-bio { font-size: 12px; color: #65676b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .no-results { padding: 20px; text-align: center; color: #65676b; font-size: 14px; }

    /* === Center navigation tabs (Facebook style) === */
    .nav-center {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1 1 auto;
      max-width: 680px;
      margin: 0 auto;
      height: 100%;
    }
    .nav-tab {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      height: 100%;
      min-width: 50px;
      padding: 0 32px;
      text-decoration: none;
      color: #65676b;
      border-bottom: 3px solid transparent;
      border-top: 3px solid transparent;
      transition: background 0.2s;
      box-sizing: border-box;
    }
    .nav-tab:hover {
      background: #f0f2f5;
      border-radius: 8px;
    }
    .nav-tab.active {
      color: #1877f2;
      border-bottom-color: #1877f2;
      border-radius: 0;
      background: transparent;
    }
    .nav-tab.active .nav-icon { fill: #1877f2; }
    .nav-icon {
      width: 24px;
      height: 24px;
      fill: #65676b;
      transition: fill 0.2s;
    }
    .nav-tab:hover .nav-icon { fill: #1877f2; }
    .nav-tab-badge {
      position: absolute;
      top: 6px;
      right: 20px;
      background: #e74c3c;
      color: white;
      border-radius: 10px;
      padding: 1px 6px;
      font-size: 11px;
      font-weight: bold;
      min-width: 18px;
      text-align: center;
      line-height: 16px;
    }

    /* === Right section === */
    .nav-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
    }

    .user-menu { position: relative; }
    .user-button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px 4px 4px;
      background: #e4e6e9;
      border: none;
      border-radius: 20px;
      cursor: pointer;
      color: #050505;
      font-weight: 600;
      font-size: 14px;
      transition: background 0.2s;
    }
    .user-button:hover { background: #d8dadf; }

    .user-avatar-img {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
    }
    .user-avatar-small {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1877f2, #42b72a);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
    }
    .user-name-text {
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

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
      top: calc(100% + 8px);
      right: 0;
      background: white;
      border-radius: 8px;
      box-shadow: 0 12px 28px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.05);
      min-width: 300px;
      padding: 8px;
      z-index: 1000;
    }

    .dropdown-profile {
      display: flex !important;
      align-items: center;
      gap: 12px;
      padding: 12px !important;
      border-radius: 8px;
    }
    .dropdown-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1877f2, #42b72a);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 16px;
      flex-shrink: 0;
    }
    .dropdown-avatar-img {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }
    .dropdown-profile-name {
      font-weight: 600;
      font-size: 16px;
      color: #050505;
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: none;
      text-align: left;
      color: #050505;
      text-decoration: none;
      cursor: pointer;
      transition: background 0.15s;
      border-radius: 8px;
      font-size: 14px;
      box-sizing: border-box;
    }
    .dropdown-item:hover { background: #f0f2f5; }
    .dropdown-icon-circle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: #e4e6e9;
      border-radius: 50%;
      font-size: 16px;
      flex-shrink: 0;
    }

    .dropdown-divider {
      height: 1px;
      background: #e4e6e9;
      margin: 4px 12px;
    }

    .logout-item { color: #e74c3c; }

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
      background: #e4e6e9;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      padding: 8px;
      transition: background 0.2s;
    }
    .hamburger-btn:hover { background: #d8dadf; }

    .hamburger-line {
      display: block;
      width: 20px;
      height: 2px;
      background: #050505;
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
      background: #f0f2f5;
      border: none;
      border-radius: 20px;
      padding: 10px 16px;
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
        padding: 0 12px;
        height: 50px;
      }
      .logo { font-size: 22px; }
    }
  `]
})
export class AppComponent implements OnInit {
  authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private titleService = inject(Title);
  private screenTimeService = inject(ScreenTimeService);
  private seoService = inject(SeoService);

  showDropdown = signal(false);
  showSearchResults = signal(false);
  searchResults = signal<UserSearchResult[]>([]);
  selectedIndex = signal(-1);
  pendingRequestsCount = signal(0);
  openReportsCount = signal(0);
  siteTitle = signal('SafeSpace');
  currentUrl = signal('/');
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

    // Close mobile menu on navigation and track current URL
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event) => {
      this.closeMobileMenu();
      this.currentUrl.set((event as NavigationEnd).urlAfterRedirects || (event as NavigationEnd).url);
    });

    // Watch for authentication changes and load pending requests
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.loadPendingRequestsCount();
        this.screenTimeService.loadSettings();

        // Reports für Admins und Moderatoren laden
        if (this.authService.isAdmin() || this.authService.isModerator()) {
          this.loadOpenReportsCount();
        }
      }
    });
  }

  ngOnInit(): void {
    this.seoService.init();
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
    this.http.get<{ site_title: string }>('/api/site-settings/title').subscribe({
      next: (response) => {
        if (response.site_title) {
          this.siteTitle.set(response.site_title);
          this.titleService.setTitle(response.site_title);
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

  isRouteActive(route: string): boolean {
    const url = this.currentUrl();
    if (route === '/') {
      return url === '/' || url === '';
    }
    return url.startsWith(route);
  }
}
