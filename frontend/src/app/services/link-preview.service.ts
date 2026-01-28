import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  domain: string;
}

@Injectable({
  providedIn: 'root'
})
export class LinkPreviewService {
  private cache = new Map<string, LinkPreview>();

  constructor(private http: HttpClient) {}

  getPreview(url: string): Observable<LinkPreview> {
    const cached = this.cache.get(url);
    if (cached) {
      return of(cached);
    }

    const params = new HttpParams().set('url', url);
    return this.http.get<LinkPreview>('/api/link-preview', { params }).pipe(
      tap(preview => this.cache.set(url, preview)),
      catchError(() => of({ url, title: null, description: null, image: null, domain: '' }))
    );
  }
}
