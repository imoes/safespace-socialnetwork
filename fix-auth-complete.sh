#!/bin/bash
# fix-auth-complete.sh
# Behebt das Auth-Problem komplett

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Complete Auth Fix                                    ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Fehler: Im Projekt-Root-Verzeichnis ausführen"
    exit 1
fi

# Backup
BACKUP_DIR="auth-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "📋 Backup: $BACKUP_DIR"

# === BACKEND FIX ===
echo ""
echo "=== Backend Fix: Registration gibt Token zurück ==="

if [ -f "backend/app/api/auth.py" ]; then
    cp backend/app/api/auth.py "$BACKUP_DIR/"
    
    cat > backend/app/api/auth.py << 'EOFAUTH'
from datetime import timedelta

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm

from app.models.schemas import UserCreate, UserLogin, Token, UserProfile
from app.services.auth_service import (
    authenticate_user,
    register_user,
    create_access_token,
    get_current_user
)
from app.config import settings
from app.db.postgres import get_user_by_username


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    """Registriert einen neuen User und gibt JWT Token zurück"""
    
    existing = await get_user_by_username(user_data.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    user = await register_user(
        username=user_data.username,
        email=user_data.email,
        password=user_data.password
    )
    
    # Token erstellen wie beim Login
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user["uid"]},
        expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token)


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login mit Username und Passwort"""
    user = await authenticate_user(form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user["uid"]},
        expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token)


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Gibt den aktuellen User zurück"""
    return UserProfile(
        uid=current_user["uid"],
        username=current_user["username"],
        email=current_user["email"],
        bio=current_user.get("bio"),
        created_at=current_user["created_at"]
    )


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout"""
    return {"message": "Successfully logged out"}
EOFAUTH
    
    echo "✅ Backend auth.py aktualisiert"
else
    echo "❌ backend/app/api/auth.py nicht gefunden"
    exit 1
fi

# === FRONTEND SERVICE FIX ===
echo ""
echo "=== Frontend Fix: AuthService erwartet Token ==="

if [ -f "frontend/src/app/services/auth.service.ts" ]; then
    cp frontend/src/app/services/auth.service.ts "$BACKUP_DIR/"
    
    cat > frontend/src/app/services/auth.service.ts << 'EOFSERVICE'
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of } from 'rxjs';

export interface User {
  uid: number;
  username: string;
  email: string;
  bio?: string;
  avatar_url?: string;
  created_at: string;
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

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    if (this.getToken()) {
      this.loadCurrentUser();
    }
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

  register(username: string, email: string, password: string): Observable<AuthResponse> {
    this.isLoadingSignal.set(true);

    return this.http.post<AuthResponse>(`${this.API_URL}/register`, {
      username,
      email,
      password
    }).pipe(
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
    localStorage.removeItem(this.TOKEN_KEY);
    this.currentUserSignal.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  private loadCurrentUser(): void {
    this.http.get<User>(`${this.API_URL}/me`).pipe(
      tap(user => {
        this.currentUserSignal.set(user);
        this.isLoadingSignal.set(false);
      }),
      catchError(() => {
        this.logout();
        return of(null);
      })
    ).subscribe();
  }
}
EOFSERVICE
    
    echo "✅ Frontend auth.service.ts aktualisiert"
else
    echo "❌ frontend/src/app/services/auth.service.ts nicht gefunden"
    exit 1
fi

# === FRONTEND COMPONENT FIX ===
echo ""
echo "=== Frontend Fix: Register Component ==="

if [ -f "frontend/src/app/components/register/register.component.ts" ]; then
    cp frontend/src/app/components/register/register.component.ts "$BACKUP_DIR/"
    
    cat > frontend/src/app/components/register/register.component.ts << 'EOFCOMPONENT'
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="register-container">
      <div class="register-card">
        <h1>Registrieren</h1>
        <p class="subtitle">Erstelle dein Konto</p>
        @if (error) { <div class="error">{{ error }}</div> }
        @if (success) { <div class="success">{{ success }}</div> }
        <form (ngSubmit)="register()">
          <input type="text" [(ngModel)]="username" name="username" placeholder="Benutzername" required minlength="3" />
          <input type="email" [(ngModel)]="email" name="email" placeholder="E-Mail" required />
          <input type="password" [(ngModel)]="password" name="password" placeholder="Passwort" required minlength="6" />
          <input type="password" [(ngModel)]="confirmPassword" name="confirmPassword" placeholder="Passwort bestätigen" required />
          <button type="submit" [disabled]="isLoading">{{ isLoading ? '...' : 'Registrieren' }}</button>
        </form>
        <p class="link">Bereits ein Konto? <a routerLink="/login">Anmelden</a></p>
      </div>
    </div>
  `,
  styles: [`
    .register-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea, #764ba2); }
    .register-card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); width: 100%; max-width: 400px; }
    h1 { margin: 0 0 8px; text-align: center; color: #1877f2; }
    .subtitle { text-align: center; color: #666; margin-bottom: 24px; }
    .error { background: #ffebee; color: #c62828; padding: 12px; border-radius: 6px; margin-bottom: 16px; }
    .success { background: #e8f5e9; color: #2e7d32; padding: 12px; border-radius: 6px; margin-bottom: 16px; }
    form { display: flex; flex-direction: column; gap: 14px; }
    input { padding: 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; }
    input:focus { outline: none; border-color: #1877f2; }
    button { padding: 14px; background: #42b72a; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
    button:disabled { background: #ccc; }
    .link { text-align: center; margin-top: 20px; }
    .link a { color: #1877f2; text-decoration: none; }
  `]
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  error = '';
  success = '';
  isLoading = false;

  register(): void {
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwörter stimmen nicht überein';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.authService.register(this.username, this.email, this.password).subscribe({
      next: () => {
        this.success = 'Registrierung erfolgreich! Weiterleitung...';
        setTimeout(() => this.router.navigate(['/']), 1000);
      },
      error: (err) => {
        this.error = err.error?.detail || 'Registrierung fehlgeschlagen';
        this.isLoading = false;
      }
    });
  }
}
EOFCOMPONENT
    
    echo "✅ Frontend register.component.ts aktualisiert"
else
    echo "❌ frontend/src/app/components/register/register.component.ts nicht gefunden"
    exit 1
fi

# === RESTART BACKEND ===
echo ""
echo "=== Backend neu starten ==="
docker-compose restart backend

echo ""
echo "⏳ Warte 15 Sekunden..."
sleep 15

# === TEST ===
echo ""
echo "=== Teste Auth-Flow ==="

USERNAME="finaltest_$(date +%s)"
PASSWORD="Test123!"

echo "Test-User: $USERNAME"

# Registration
echo ""
echo "1️⃣  Test Registration..."
REG_RESULT=$(curl -s -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"email\":\"test@test.com\",\"password\":\"$PASSWORD\"}")

if echo "$REG_RESULT" | grep -q "access_token"; then
    echo "✅ Registration gibt TOKEN zurück!"
    TOKEN=$(echo "$REG_RESULT" | jq -r '.access_token')
    echo "Token: ${TOKEN:0:50}..."
else
    echo "❌ Registration gibt KEINEN Token zurück:"
    echo "$REG_RESULT" | jq '.'
    exit 1
fi

# Test mit Token
echo ""
echo "2️⃣  Test /me mit Token..."
ME_RESULT=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/auth/me)

if echo "$ME_RESULT" | grep -q "username"; then
    echo "✅ Token funktioniert!"
    echo "$ME_RESULT" | jq '{username, uid}'
else
    echo "❌ Token funktioniert NICHT"
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║   ✅ AUTH FIX ERFOLGREICH!                             ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Backend:"
echo "  ✅ Registration gibt Token zurück"
echo "  ✅ Token ist gültig"
echo ""
echo "Frontend (Hot-Reload bereits aktiv):"
echo "  ✅ AuthService erwartet Token"
echo "  ✅ Register Component speichert Token"
echo ""
echo "Jetzt im Browser testen:"
echo "  1. http://localhost:4200/register"
echo "  2. Neuen User registrieren"
echo "  3. → Automatisch eingeloggt!"
echo "  4. → Feed lädt!"
echo "  5. → Keine 401 Fehler mehr!"
echo ""
echo "Backups: $BACKUP_DIR"
