import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, Report } from '../../services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-container">
      <h1>🛡️ Moderator Dashboard</h1>

      <!-- Stats Cards -->
      @if (admin.stats(); as stats) {
        <div class="stats-grid">
          <div class="stat-card warning">
            <div class="stat-number">{{ stats.reports.pending_reports }}</div>
            <div class="stat-label">Offene Reports</div>
          </div>
          <div class="stat-card info">
            <div class="stat-number">{{ stats.reports.reviewing_reports }}</div>
            <div class="stat-label">In Bearbeitung</div>
          </div>
          <div class="stat-card success">
            <div class="stat-number">{{ stats.reports.resolved_today }}</div>
            <div class="stat-label">Heute gelöst</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ stats.users.suspended_users }}</div>
            <div class="stat-label">Suspendiert</div>
          </div>
        </div>
      }

      <!-- Tabs -->
      <div class="tabs">
        <button [class.active]="activeTab === 'reports'" (click)="activeTab = 'reports'">
          📋 Reports ({{ admin.reports().length }})
        </button>
        <button [class.active]="activeTab === 'actions'" (click)="activeTab = 'actions'; loadActions()">
          📝 Aktionen
        </button>
      </div>

      <!-- Reports Tab -->
      @if (activeTab === 'reports') {
        <div class="reports-list">
          @for (report of admin.reports(); track report.report_id) {
            <div class="report-card" [class.reviewing]="report.status === 'reviewing'">
              <div class="report-header">
                <span class="report-id">#{{ report.report_id }}</span>
                <span class="category-badge" [class]="report.category">{{ getCategoryLabel(report.category) }}</span>
                <span class="status-badge" [class]="report.status">{{ report.status }}</span>
              </div>
              
              <div class="report-meta">
                <span>📝 Post von <strong>{{ report.author_username }}</strong></span>
                <span>🚨 Gemeldet von <strong>{{ report.reporter_username }}</strong></span>
                <span>🕐 {{ report.created_at | date:'dd.MM.yyyy HH:mm' }}</span>
              </div>
              
              <div class="report-reason">
                <strong>Grund:</strong> {{ report.reason }}
                @if (report.description) {
                  <p>{{ report.description }}</p>
                }
              </div>

              <!-- Post-Vorschau -->
              @if (report.post_content) {
                <div class="post-preview">
                  <div class="post-header-mini">
                    <strong>{{ report.author_username }}</strong>
                    <span class="post-time">{{ report.post_created_at | date:'dd.MM.yyyy HH:mm' }}</span>
                  </div>
                  <div class="post-content">
                    {{ report.post_content }}
                  </div>
                  <div class="post-stats">
                    <span>❤️ {{ report.post_likes_count || 0 }}</span>
                    <span>💬 {{ report.post_comments_count || 0 }}</span>
                    <span class="visibility-badge">{{ getVisibilityLabel(report.post_visibility || 'public') }}</span>
                  </div>
                </div>
              }

              <div class="report-actions">
                @if (report.status === 'pending') {
                  <button class="btn-primary" (click)="assignToMe(report)">
                    🙋 Übernehmen
                  </button>
                } @else if (report.status === 'reviewing') {
                  <button class="btn-view" (click)="viewReport(report)">
                    👁️ Details
                  </button>
                  <button class="btn-success" (click)="quickResolve(report, false, 'approve')">
                    ✅ OK
                  </button>
                  <button class="btn-warning" (click)="quickResolve(report, false, 'delete_post')">
                    🗑️ Löschen
                  </button>
                  <button class="btn-danger" (click)="quickResolve(report, false, 'suspend')">
                    ⛔ Sperren
                  </button>
                  <button class="btn-secondary" (click)="quickResolve(report, true)">
                    ❌ Abweisen
                  </button>
                }
              </div>
            </div>
          } @empty {
            <div class="empty-state">
              <p>🎉 Keine offenen Reports!</p>
            </div>
          }
        </div>
      }

      <!-- Actions Tab -->
      @if (activeTab === 'actions') {
        <div class="actions-list">
          @for (action of admin.actions(); track action.action_id) {
            <div class="action-item">
              <span class="action-type" [class]="action.action_type">{{ getActionLabel(action.action_type) }}</span>
              <span class="action-mod">von {{ action.moderator_username }}</span>
              @if (action.target_user_uid) {
                <span>→ User #{{ action.target_user_uid }}</span>
              }
              @if (action.target_post_id) {
                <span>→ Post #{{ action.target_post_id }}</span>
              }
              <span class="action-time">{{ action.created_at | date:'dd.MM. HH:mm' }}</span>
            </div>
          }
        </div>
      }

      <!-- Report Detail Modal -->
      @if (selectedReport) {
        <div class="modal-overlay" (click)="selectedReport = null">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>Report #{{ selectedReport.report_id }}</h2>
            
            @if (selectedPostContent) {
              <div class="post-preview">
                <strong>Post-Inhalt:</strong>
                <p>{{ selectedPostContent }}</p>
              </div>
            }
            
            <div class="resolve-form">
              <label>Notiz zur Lösung:</label>
              <textarea [(ngModel)]="resolutionNote" rows="3"></textarea>
              
              <div class="modal-actions">
                <button class="btn-success" (click)="resolveWithNote('approve')">✅ Genehmigen</button>
                <button class="btn-warning" (click)="resolveWithNote('delete_post')">🗑️ Post löschen</button>
                <button class="btn-danger" (click)="resolveWithNote('suspend')">⛔ User sperren</button>
                <button class="btn-secondary" (click)="resolveWithNote(null, true)">❌ Abweisen</button>
              </div>
            </div>
            
            <button class="close-btn" (click)="selectedReport = null">×</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .admin-container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { margin-bottom: 24px; }
    
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
    .stat-card.warning { border-left: 4px solid #ff9800; }
    .stat-card.info { border-left: 4px solid #2196f3; }
    .stat-card.success { border-left: 4px solid #4caf50; }
    .stat-number { font-size: 32px; font-weight: bold; }
    .stat-label { color: #666; margin-top: 4px; }
    
    .tabs { display: flex; gap: 8px; margin-bottom: 20px; }
    .tabs button { padding: 10px 20px; border: none; background: #e0e0e0; border-radius: 6px; cursor: pointer; }
    .tabs button.active { background: #1877f2; color: white; }
    
    .reports-list { display: flex; flex-direction: column; gap: 16px; }
    .report-card { background: white; padding: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .report-card.reviewing { border-left: 4px solid #2196f3; }
    
    .report-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .report-id { font-weight: bold; color: #666; }
    .category-badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; background: #e0e0e0; }
    .category-badge.hate_speech { background: #ffcdd2; color: #c62828; }
    .category-badge.harassment { background: #ffe0b2; color: #e65100; }
    .category-badge.spam { background: #e1bee7; color: #7b1fa2; }
    .status-badge { margin-left: auto; padding: 4px 8px; border-radius: 12px; font-size: 12px; }
    .status-badge.pending { background: #fff3e0; color: #e65100; }
    .status-badge.reviewing { background: #e3f2fd; color: #1565c0; }
    
    .report-meta { display: flex; gap: 16px; font-size: 14px; color: #666; margin-bottom: 12px; }
    .report-reason { background: #f5f5f5; padding: 12px; border-radius: 6px; margin-bottom: 12px; }
    .report-reason p { margin: 8px 0 0; color: #666; }
    
    .report-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .report-actions button { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-primary { background: #1877f2; color: white; }
    .btn-success { background: #4caf50; color: white; }
    .btn-warning { background: #ff9800; color: white; }
    .btn-danger { background: #f44336; color: white; }
    .btn-secondary { background: #9e9e9e; color: white; }
    .btn-view { background: #e0e0e0; }
    
    .empty-state { text-align: center; padding: 60px; background: #f9f9f9; border-radius: 8px; }
    
    .actions-list { background: white; border-radius: 8px; overflow: hidden; }
    .action-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #eee; }
    .action-type { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .action-type.delete { background: #ffcdd2; color: #c62828; }
    .action-type.suspend_user { background: #ffcdd2; color: #c62828; }
    .action-type.approve { background: #c8e6c9; color: #2e7d32; }
    .action-type.warn_user { background: #fff3e0; color: #e65100; }
    .action-mod { color: #666; }
    .action-time { margin-left: auto; color: #999; font-size: 12px; }
    
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: white; padding: 24px; border-radius: 12px; width: 90%; max-width: 600px; position: relative; }
    .close-btn { position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 24px; cursor: pointer; }
    .post-preview { background: #f9f9f9; padding: 16px; border-radius: 8px; margin: 12px 0; border-left: 3px solid #1877f2; }
    .post-header-mini { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
    .post-header-mini strong { color: #1877f2; }
    .post-time { color: #999; font-size: 13px; }
    .post-content { white-space: pre-wrap; word-wrap: break-word; margin-bottom: 12px; line-height: 1.5; }
    .post-stats { display: flex; gap: 16px; font-size: 14px; color: #666; }
    .visibility-badge { margin-left: auto; padding: 2px 8px; background: #e0e0e0; border-radius: 12px; font-size: 12px; }
    .resolve-form label { display: block; margin-bottom: 8px; font-weight: bold; }
    .resolve-form textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; resize: vertical; }
    .modal-actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
    .modal-actions button { flex: 1; min-width: 120px; }
  `]
})
export class AdminDashboardComponent implements OnInit {
  admin = inject(AdminService);
  
  activeTab = 'reports';
  selectedReport: Report | null = null;
  selectedPostContent: string | null = null;
  resolutionNote = '';

  ngOnInit(): void {
    this.admin.loadDashboard();
    this.admin.loadReports();
  }

  loadActions(): void {
    this.admin.loadActions();
  }

  assignToMe(report: Report): void {
    this.admin.assignReport(report.report_id).subscribe();
  }

  viewReport(report: Report): void {
    this.selectedReport = report;
    this.resolutionNote = '';
    
    this.admin.getReportDetail(report.report_id).subscribe({
      next: (res) => {
        this.selectedPostContent = res.post?.content || 'Post nicht gefunden';
      }
    });
  }

  quickResolve(report: Report, dismiss: boolean, action?: string): void {
    const note = dismiss ? 'Report abgewiesen' : `Aktion: ${action || 'genehmigt'}`;
    this.admin.resolveReport(report.report_id, note, dismiss, action).subscribe();
  }

  resolveWithNote(action: string | null, dismiss = false): void {
    if (!this.selectedReport) return;
    
    this.admin.resolveReport(
      this.selectedReport.report_id,
      this.resolutionNote || 'Keine Notiz',
      dismiss,
      action || undefined
    ).subscribe({
      next: () => {
        this.selectedReport = null;
        this.resolutionNote = '';
      }
    });
  }

  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      hate_speech: '🔴 Hassrede',
      harassment: '🟠 Belästigung',
      spam: '🟣 Spam',
      inappropriate: '🟡 Unangemessen',
      other: '⚪ Sonstiges'
    };
    return labels[category] || category;
  }

  getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      delete: '🗑️ Gelöscht',
      approve: '✅ Genehmigt',
      flag: '🚩 Markiert',
      block: '🚫 Blockiert',
      warn_user: '⚠️ Verwarnt',
      suspend_user: '⛔ Suspendiert',
      ban_user: '🔨 Gebannt',
      dismiss_report: '❌ Abgewiesen'
    };
    return labels[action] || action;
  }

  getVisibilityLabel(visibility: string): string {
    const labels: Record<string, string> = {
      public: '🌍 Öffentlich',
      friends: '👋 Freunde',
      acquaintance: '👋 Bekannte',
      close_friend: '💚 Enge Freunde',
      family: '👨‍👩‍👧 Familie',
      private: '🔒 Privat'
    };
    return labels[visibility] || visibility;
  }
}
