import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Post } from '../../services/feed.service';
import { ReportService } from '../../services/report.service';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="post-card">
      <div class="post-header">
        <div class="avatar">{{ post.author_username.charAt(0).toUpperCase() }}</div>
        <div class="author-info">
          <span class="username">{{ post.author_username }}</span>
          <span class="timestamp">{{ post.created_at | date:'dd.MM.yyyy HH:mm' }}</span>
        </div>
        <div class="post-menu">
          <button class="menu-btn" (click)="showMenu = !showMenu">⋮</button>
          @if (showMenu) {
            <div class="menu-dropdown">
              @if (post.author_uid === currentUid) {
                <button (click)="onDelete(); showMenu = false">🗑️ Löschen</button>
              } @else {
                <button (click)="showReportModal = true; showMenu = false">🚨 Melden</button>
              }
            </div>
          }
        </div>
      </div>

      <div class="post-content"><p>{{ post.content }}</p></div>

      @if (post.media_urls.length > 0) {
        <div class="post-media">
          @for (url of post.media_urls; track url) {
            @if (isImage(url)) { <img [src]="url" alt="Media" /> }
            @else if (isVideo(url)) { <video [src]="url" controls></video> }
          }
        </div>
      }

      <div class="post-actions">
        <button class="action-btn" [class.liked]="isLiked" (click)="toggleLike()">{{ isLiked ? '❤️' : '🤍' }} {{ post.likes_count }}</button>
        <button class="action-btn">💬 {{ post.comments_count }}</button>
        <span class="visibility">{{ getVisibilityLabel() }}</span>
      </div>

      @if (showReportModal) {
        <div class="modal-overlay" (click)="showReportModal = false">
          <div class="report-modal" (click)="$event.stopPropagation()">
            <h3>🚨 Post melden</h3>
            <select [(ngModel)]="reportCategory">
              <option value="hate_speech">Hassrede</option>
              <option value="harassment">Belästigung</option>
              <option value="spam">Spam</option>
              <option value="inappropriate">Unangemessen</option>
              <option value="other">Sonstiges</option>
            </select>
            <textarea [(ngModel)]="reportReason" placeholder="Warum meldest du diesen Post?" rows="3"></textarea>
            <div class="modal-actions">
              <button class="btn-cancel" (click)="showReportModal = false">Abbrechen</button>
              <button class="btn-submit" (click)="submitReport()" [disabled]="!reportReason">Melden</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .post-card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 15px; position: relative; }
    .post-header { display: flex; align-items: center; padding: 12px 16px; gap: 12px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #1877f2, #42b72a); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
    .author-info { flex: 1; display: flex; flex-direction: column; }
    .username { font-weight: 600; }
    .timestamp { font-size: 12px; color: #65676b; }
    .post-menu { position: relative; }
    .menu-btn { background: none; border: none; font-size: 20px; cursor: pointer; padding: 4px 8px; color: #65676b; }
    .menu-dropdown { position: absolute; right: 0; top: 100%; background: white; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); min-width: 150px; z-index: 10; }
    .menu-dropdown button { display: block; width: 100%; padding: 12px 16px; border: none; background: none; text-align: left; cursor: pointer; }
    .menu-dropdown button:hover { background: #f0f2f5; }
    .post-content { padding: 0 16px 12px; }
    .post-content p { margin: 0; line-height: 1.5; white-space: pre-wrap; }
    .post-media img, .post-media video { width: 100%; max-height: 500px; object-fit: cover; }
    .post-actions { display: flex; align-items: center; padding: 8px 16px; border-top: 1px solid #e4e6e9; gap: 12px; }
    .action-btn { background: none; border: none; padding: 8px 12px; cursor: pointer; color: #65676b; }
    .action-btn:hover { background: #f0f2f5; border-radius: 4px; }
    .action-btn.liked { color: #f44336; }
    .visibility { margin-left: auto; font-size: 11px; color: #999; }
    
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
    .report-modal { background: white; padding: 24px; border-radius: 12px; width: 90%; max-width: 400px; }
    .report-modal h3 { margin: 0 0 16px; }
    .report-modal select, .report-modal textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 12px; font-family: inherit; box-sizing: border-box; }
    .modal-actions { display: flex; gap: 12px; }
    .btn-cancel { flex: 1; padding: 12px; border: 1px solid #ddd; background: white; border-radius: 8px; cursor: pointer; }
    .btn-submit { flex: 1; padding: 12px; border: none; background: #f44336; color: white; border-radius: 8px; cursor: pointer; }
    .btn-submit:disabled { background: #ccc; }
  `]
})
export class PostCardComponent {
  @Input() post!: Post;
  @Input() currentUid?: number;
  @Output() like = new EventEmitter<Post>();
  @Output() unlike = new EventEmitter<Post>();
  @Output() delete = new EventEmitter<Post>();

  private reportService = inject(ReportService);

  isLiked = false;
  showMenu = false;
  showReportModal = false;
  reportCategory = 'hate_speech';
  reportReason = '';

  toggleLike(): void {
    this.isLiked ? this.unlike.emit(this.post) : this.like.emit(this.post);
    this.isLiked = !this.isLiked;
  }

  onDelete(): void {
    if (confirm('Post wirklich löschen?')) {
      this.delete.emit(this.post);
    }
  }

  submitReport(): void {
    this.reportService.reportPost({
      post_id: this.post.post_id,
      post_author_uid: this.post.author_uid,
      reason: this.reportReason,
      category: this.reportCategory
    }).subscribe({
      next: () => {
        alert('Danke für deine Meldung! Ein Moderator wird sie prüfen.');
        this.showReportModal = false;
        this.reportReason = '';
      },
      error: () => alert('Fehler beim Melden')
    });
  }

  isImage(url: string): boolean { return /\.(jpg|jpeg|png|gif|webp)$/i.test(url); }
  isVideo(url: string): boolean { return /\.(mp4|webm|mov)$/i.test(url); }
  
  getVisibilityLabel(): string {
    const labels: Record<string, string> = { 
      public: '🌍 Öffentlich', 
      acquaintance: '👋 Bekannte',
      close_friend: '💚 Enge Freunde',
      family: '👨‍👩‍👧 Familie',
      private: '🔒 Privat' 
    };
    return labels[this.post.visibility] || this.post.visibility;
  }
}
