import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Liste der öffentlichen Endpoints, die KEINEN Token benötigen
  const publicEndpoints = ['/api/auth/login', '/api/auth/register'];

  // Prüfen ob es ein öffentlicher Endpoint ist
  const isPublicEndpoint = publicEndpoints.some(endpoint => req.url.includes(endpoint));

  if (isPublicEndpoint) {
    console.log('🔓 [Interceptor] Public endpoint detected, skipping token:', req.url);
    return next(req);
  }

  // Token aus Service holen
  const token = authService.getToken();

  console.log('🔍 [Interceptor] Called for:', req.url);
  console.log('🔑 [Interceptor] Token from service:', token ? token.substring(0, 30) + '...' : 'NONE');
  console.log('🔑 [Interceptor] Token from localStorage:', localStorage.getItem('access_token') ? 'EXISTS' : 'NONE');

  // Request clonen und Authorization Header hinzufügen
  if (token) {
    console.log('➕ [Interceptor] Adding Authorization header');
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  } else {
    console.warn('⚠️ [Interceptor] NO TOKEN AVAILABLE!');
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('❌ [Interceptor] HTTP Error:', error.status, req.url);
      
      // Bei 401 ausloggen und zu Login navigieren
      if (error.status === 401) {
        console.log('🚪 [Interceptor] 401 detected, logging out...');
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
