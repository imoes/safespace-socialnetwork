import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of } from 'rxjs';

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

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    if (this.getToken()) {
      this.loadCurrentUser();
    }
  }

  // Hilfsfunktion: Headers mit Token erstellen
  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    console.log('🔑 Creating headers with token:', token ? 'YES' : 'NO');
    
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
        console.log('✅ Login erfolgreich, Token erhalten');
        this.setToken(response.access_token);
        this.loadCurrentUser();
      }),
      catchError(error => {
        this.isLoadingSignal.set(false);
        throw error;
      })
    );
  }

  register(username: string, email: string, password: string, firstName?: string, lastName?: string): Observable<AuthResponse> {
    this.isLoadingSignal.set(true);

    return this.http.post<AuthResponse>(`${this.API_URL}/register`, {
      username,
      email,
      password,
      first_name: firstName,
      last_name: lastName
    }).pipe(
      tap(response => {
        console.log('✅ Registration erfolgreich, Token erhalten');
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
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem('preferredLanguage');
    this.currentUserSignal.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private setToken(token: string): void {
    console.log('💾 Speichere Token in localStorage');
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  loadCurrentUser(): void {
    console.log('📡 Lade User mit Token...');

    // WICHTIG: Headers direkt hier setzen statt auf Interceptor zu vertrauen!
    this.http.get<User>(`${this.API_URL}/me`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(user => {
        console.log('✅ User geladen:', user.username);
        this.currentUserSignal.set(user);
        this.isLoadingSignal.set(false);

        // Apply user's stored language preference
        if (user.preferred_language) {
          const currentLang = localStorage.getItem('preferredLanguage');
          if (currentLang !== user.preferred_language) {
            console.log(`🌐 Applying user language preference: ${user.preferred_language}`);
            localStorage.setItem('preferredLanguage', user.preferred_language);
            // Reload to apply language if it differs from current
            if (currentLang && currentLang !== user.preferred_language) {
              window.location.reload();
            }
          }
        }
      }),
      catchError((error) => {
        console.error('❌ User laden fehlgeschlagen:', error);
        console.log('Token war:', this.getToken()?.substring(0, 20));
        this.logout();
        return of(null);
      })
    ).subscribe();
  }
}
