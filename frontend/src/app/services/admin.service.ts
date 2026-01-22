import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface DashboardStats {
  reports: {
    pending_reports: number;
    reviewing_reports: number;
    resolved_today: number;
    total_reports_week: number;
  };
  users: {
    total_users: number;
    suspended_users: number;
    new_users_week: number;
  };
  moderators: {
    actions_today: number;
    active_moderators: number;
  };
}

export interface Report {
  report_id: number;
  post_id: number;
  post_author_uid: number;
  reporter_uid: number;
  reporter_username: string;
  author_username: string;
  reason: string;
  category: string;
  description: string | null;
  status: string;
  created_at: string;
  assigned_moderator_uid: number | null;
}

export interface ModeratorAction {
  action_id: number;
  moderator_uid: number;
  moderator_username: string;
  action_type: string;
  target_post_id: number | null;
  target_user_uid: number | null;
  reason: string | null;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly API_URL = '/api/admin';
  private http = inject(HttpClient);

  private statsSignal = signal<DashboardStats | null>(null);
  private reportsSignal = signal<Report[]>([]);
  private actionsSignal = signal<ModeratorAction[]>([]);
  private isLoadingSignal = signal(false);

  readonly stats = computed(() => this.statsSignal());
  readonly reports = computed(() => this.reportsSignal());
  readonly actions = computed(() => this.actionsSignal());
  readonly isLoading = computed(() => this.isLoadingSignal());

  loadDashboard(): void {
    this.isLoadingSignal.set(true);
    this.http.get<DashboardStats>(`${this.API_URL}/dashboard`).subscribe({
      next: (stats) => {
        this.statsSignal.set(stats);
        this.isLoadingSignal.set(false);
      },
      error: () => this.isLoadingSignal.set(false)
    });
  }

  loadReports(): void {
    this.http.get<{ reports: Report[] }>(`${this.API_URL}/reports`).subscribe({
      next: (res) => this.reportsSignal.set(res.reports)
    });
  }

  getReportDetail(reportId: number): Observable<{ report: Report; post: any }> {
    return this.http.get<{ report: Report; post: any }>(`${this.API_URL}/reports/${reportId}`);
  }

  assignReport(reportId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/reports/${reportId}/assign`, {}).pipe(
      tap(() => this.loadReports())
    );
  }

  resolveReport(reportId: number, resolutionNote: string, dismiss: boolean, action?: string): Observable<any> {
    return this.http.post(`${this.API_URL}/reports/${reportId}/resolve`, {
      resolution_note: resolutionNote,
      dismiss,
      action
    }).pipe(
      tap(() => {
        this.loadReports();
        this.loadDashboard();
      })
    );
  }

  suspendUser(userUid: number, reason: string, durationDays?: number): Observable<any> {
    return this.http.post(`${this.API_URL}/users/${userUid}/suspend`, {
      reason,
      duration_days: durationDays
    });
  }

  unsuspendUser(userUid: number): Observable<any> {
    return this.http.post(`${this.API_URL}/users/${userUid}/unsuspend`, {});
  }

  setUserRole(userUid: number, role: string): Observable<any> {
    return this.http.post(`${this.API_URL}/users/${userUid}/role`, { role });
  }

  loadActions(): void {
    this.http.get<{ actions: ModeratorAction[] }>(`${this.API_URL}/actions`).subscribe({
      next: (res) => this.actionsSignal.set(res.actions)
    });
  }

  deletePost(postId: number, authorUid: number, reason: string): Observable<any> {
    return this.http.post(`${this.API_URL}/posts/action`, {
      action_type: 'delete',
      target_post_id: postId,
      post_author_uid: authorUid,
      reason
    });
  }
}
