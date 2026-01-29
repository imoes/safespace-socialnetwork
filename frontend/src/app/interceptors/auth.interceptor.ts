import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // Public endpoints that don't need a token
  const publicEndpoints = ['/api/auth/login', '/api/auth/register'];
  const isPublicEndpoint = publicEndpoints.some(endpoint => req.url.includes(endpoint));

  if (isPublicEndpoint) {
    return next(req);
  }

  // Get token directly from localStorage (not via AuthService to avoid circular dependency)
  const token = localStorage.getItem('access_token');

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        localStorage.removeItem('access_token');
        // Only redirect to login if not already on a public page
        const currentUrl = router.url;
        const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/terms', '/privacy-policy'];
        const isPublicPage = publicPaths.some(p => currentUrl.startsWith(p));
        if (!isPublicPage) {
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    })
  );
};
