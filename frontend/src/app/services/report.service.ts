import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CreateReportRequest {
  post_id: number;
  post_author_uid: number;
  reason: string;
  category: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private readonly API_URL = '/api/reports';
  private http = inject(HttpClient);

  reportPost(request: CreateReportRequest): Observable<{ message: string; report_id: number }> {
    return this.http.post<{ message: string; report_id: number }>(this.API_URL, request);
  }
}
