import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of } from 'rxjs';
import { I18nService } from './i18n.service';
import { ScreenTimeService } from './screen-time.service';

export interface User {
  uid: number;
  username: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  bio?: string;
  avatar_url?: string;
  created_at: string;
  profile_picture?: string;
  first_name?: string;
  last_name?: string;
  preferred_language?: string;
  birthday?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = '/api/auth';
  private readonly TOKEN_KEY = 'access_token';

  private currentUserSignal = signal<User | null>(null);
  private isLoadingSignal = signal(false);

  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly isLoading = computed(() => this.isLoadingSignal());
  readonly isAdmin = computed(() => this.currentUserSignal()?.role === 'admin');
  readonly isModerator = computed(() => {
    const role = this.currentUserSignal()?.role;
    return role === 'admin' || role === 'moderator';
  });

  private i18n = inject(I18nService);
  private screenTime = inject(ScreenTimeService);

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    if (this.getToken()) {
      this.loadCurrentUser();
    }
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    if (token) {
      return new HttpHeaders({
        'Authorization': `Bearer ${token}`
      });
    }
    return new HttpHeaders();
  }

  login(username: string, password: string): Observable<AuthResponse> {
    this.isLoadingSignal.set(true);

    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    return this.http.post<AuthResponse>(`${this.API_URL}/login`, formData).pipe(
      tap(response => {
        this.setToken(response.access_token);
        this.loadCurrentUser();
      }),
      catchError(error => {
        this.isLoadingSignal.set(false);
        throw error;
      })
    );
  }

  register(username: string, email: string, password: string, firstName?: string, lastName?: string, birthday?: string, parentEmail?: string): Observable<AuthResponse> {
    this.isLoadingSignal.set(true);

    const body: any = {
      username,
      email,
      password,
      first_name: firstName,
      last_name: lastName,
      birthday: birthday || null
    };
    if (parentEmail) {
      body.parent_email = parentEmail;
    }

    return this.http.post<AuthResponse>(`${this.API_URL}/register`, body).pipe(
      tap(response => {
        this.setToken(response.access_token);
        this.loadCurrentUser();
      }),
      catchError(error => {
        this.isLoadingSignal.set(false);
        throw error;
      })
    );
  }

  logout(): void {
    // Persist screen time usage to backend before logout
    this.screenTime.persistUsageToBackend();
    this.screenTime.destroy();

    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem('preferredLanguage');
    this.currentUserSignal.set(null);

    // Reset i18n to browser default language so the login page doesn't show
    // the previous user's language
    try {
      const browserLang = navigator.language.split('-')[0];
      const languages = this.i18n.languages();
      const supported = languages.find(l => l.code === browserLang);
      const defaultLang = supported ? browserLang : 'en';
      this.i18n.setLanguage(defaultLang);
    } catch (e) {
      // i18n not available, ignore
    }

    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  loadCurrentUser(): void {
    this.http.get<User>(`${this.API_URL}/me`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(user => {
        this.currentUserSignal.set(user);
        this.isLoadingSignal.set(false);

        // Apply user's stored language preference
        const currentI18nLang = this.i18n.currentLanguage()?.code;

        if (user.preferred_language) {
          // User has a language in DB - apply it if different from current
          if (currentI18nLang !== user.preferred_language) {
            localStorage.setItem('preferredLanguage', user.preferred_language);
            this.i18n.setLanguage(user.preferred_language);
          }
        } else {
          // User has no language in DB - save current language to DB for future logins
          const currentLang = localStorage.getItem('preferredLanguage') || currentI18nLang || 'en';
          this.http.patch('/api/users/me/language', {
            preferred_language: currentLang
          }, {
            headers: this.getAuthHeaders()
          }).subscribe();
        }
      }),
      catchError((error) => {
        console.error('Failed to load user:', error);
        // Clear token and state but do NOT navigate - the auth guard handles
        // redirects for protected routes. Navigating here would kick users
        // off public pages like /register when an old token is invalid.
        localStorage.removeItem(this.TOKEN_KEY);
        this.currentUserSignal.set(null);
        this.isLoadingSignal.set(false);
        return of(null);
      })
    ).subscribe();
  }
}
