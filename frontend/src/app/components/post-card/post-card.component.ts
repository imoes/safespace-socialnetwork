import { Component, Input, Output, EventEmitter, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Post, FeedService, Comment } from '../../services/feed.service';
import { ReportService } from '../../services/report.service';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="post-card">
      <div class="post-header">
        @if (post.author_profile_picture) {
          <img [src]="post.author_profile_picture" class="avatar avatar-img" [alt]="post.author_username" />
        } @else {
          <div class="avatar">{{ post.author_username.charAt(0).toUpperCase() }}</div>
        }
        <div class="author-info">
          <span class="username">{{ post.author_username }}</span>
          <span class="timestamp">{{ post.created_at | date:'dd.MM.yyyy HH:mm' }}</span>
        </div>
      </div>

      @if (editingPost) {
        <div class="post-edit">
          <textarea [(ngModel)]="editPostContent" placeholder="Was möchtest du ändern?" rows="5"></textarea>
          <div class="post-edit-actions">
            <button class="btn-save-post" (click)="updatePostContent()">💾 Speichern</button>
            <button class="btn-cancel-post" (click)="cancelEditPost()">❌ Abbrechen</button>
          </div>
        </div>
      } @else {
        <div class="post-content" [innerHTML]="getContentWithHashtags()" (click)="handleContentClick($event)"></div>
      }

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
        <button class="action-btn" (click)="toggleComments()">💬 {{ post.comments_count }}</button>
        @if (post.author_uid === currentUid) {
          <div class="post-controls">
            <button class="action-icon-btn" (click)="startEditPost()" title="Bearbeiten">✏️</button>
            <button class="action-icon-btn" (click)="onDelete()" title="Löschen">🗑️</button>
            <div class="visibility-wrapper" #visibilityWrapper>
              <span class="visibility clickable" (click)="toggleVisibilityDropdown($event)" title="Klicken zum Ändern">{{ getVisibilityLabel() }}</span>
              @if (showVisibilityDropdown) {
                <div class="visibility-dropdown">
                  <button (click)="changeVisibility('public')">🌍 Öffentlich</button>
                  <button (click)="changeVisibility('friends')">👥 Alle Freunde</button>
                  <button (click)="changeVisibility('close_friends')">💚 Enge Freunde</button>
                  <button (click)="changeVisibility('family')">👨‍👩‍👧‍👦 Familie</button>
                  <button (click)="changeVisibility('private')">🔒 Nur ich</button>
                </div>
              }
            </div>
          </div>
        } @else {
          <div class="post-controls">
            <button class="action-btn report-btn" (click)="showReportModal = true" title="Melden">🚨</button>
            <span class="visibility">{{ getVisibilityLabel() }}</span>
          </div>
        }
      </div>

      @if (showComments) {
        <div class="comments-section">
          <div class="comment-input">
            <input type="text" [(ngModel)]="newComment" placeholder="Schreibe einen Kommentar..." (keyup.enter)="addComment()" />
            <button class="btn-submit-comment" (click)="addComment()" [disabled]="!newComment.trim()">Senden</button>
          </div>

          @if (loadingComments) {
            <div class="loading">Kommentare werden geladen...</div>
          }

          @if (comments.length > 0) {
            <div class="comments-list">
              @for (comment of comments; track comment.comment_id) {
                <div class="comment">
                  <div class="comment-header">
                    <div class="comment-avatar">{{ comment.author_username.charAt(0).toUpperCase() }}</div>
                    <div class="comment-info">
                      <span class="comment-username">{{ comment.author_username }}</span>
                      <span class="comment-timestamp">{{ comment.created_at | date:'dd.MM.yyyy HH:mm' }}</span>
                    </div>
                  </div>
                  @if (editingCommentId === comment.comment_id) {
                    <div class="comment-edit">
                      <input type="text" [(ngModel)]="editCommentContent" (keyup.enter)="saveCommentEdit(comment)" (keyup.escape)="cancelCommentEdit()" />
                      <div class="comment-edit-actions">
                        <button class="btn-save-comment" (click)="saveCommentEdit(comment)">💾 Speichern</button>
                        <button class="btn-cancel-comment" (click)="cancelCommentEdit()">❌ Abbrechen</button>
                      </div>
                    </div>
                  } @else {
                    <div class="comment-content">{{ comment.content }}</div>
                  }
                  <div class="comment-actions">
                    <button class="comment-like-btn" [class.liked]="comment.is_liked_by_user" (click)="toggleCommentLike(comment)">
                      {{ comment.is_liked_by_user ? '❤️' : '🤍' }} {{ comment.likes_count }}
                    </button>
                    @if (comment.user_uid === currentUid) {
                      <button class="comment-action-btn" (click)="startEditComment(comment)">✏️ Bearbeiten</button>
                      <button class="comment-action-btn" (click)="deleteCommentConfirm(comment)">🗑️ Löschen</button>
                    }
                  </div>
                </div>
              }
            </div>
          } @else if (!loadingComments) {
            <div class="no-comments">Noch keine Kommentare. Sei der Erste!</div>
          }
        </div>
      }

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

      @if (showVisibilityModal) {
        <div class="modal-overlay" (click)="showVisibilityModal = false">
          <div class="visibility-modal" (click)="$event.stopPropagation()">
            <h3>👁️ Sichtbarkeit ändern</h3>
            <p class="current-visibility">Aktuelle Sichtbarkeit: <strong>{{ getVisibilityLabel() }}</strong></p>
            <select [(ngModel)]="newVisibility">
              <option value="public">🌍 Öffentlich</option>
              <option value="friends">👥 Alle Freunde</option>
              <option value="close_friends">💚 Enge Freunde</option>
              <option value="family">👨‍👩‍👧‍👦 Familie</option>
              <option value="private">🔒 Nur ich</option>
            </select>
            <div class="modal-actions">
              <button class="btn-cancel" (click)="showVisibilityModal = false">Abbrechen</button>
              <button class="btn-submit" (click)="updateVisibility()">Speichern</button>
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
    .avatar-img { object-fit: cover; }
    .author-info { flex: 1; display: flex; flex-direction: column; }
    .username { font-weight: 600; }
    .timestamp { font-size: 12px; color: #65676b; }
    .post-content { padding: 0 16px 12px; }
    .post-content p { margin: 0; line-height: 1.5; white-space: pre-wrap; }
    .post-content ::ng-deep .hashtag { color: #1877f2; cursor: pointer; font-weight: 500; text-decoration: none; }
    .post-content ::ng-deep .hashtag:hover { text-decoration: underline; }
    .post-edit { padding: 0 16px 12px; }
    .post-edit textarea { width: 100%; padding: 12px; border: 1px solid #1877f2; border-radius: 8px; font-family: inherit; font-size: 14px; box-sizing: border-box; resize: vertical; }
    .post-edit-actions { display: flex; gap: 8px; margin-top: 12px; }
    .btn-save-post, .btn-cancel-post { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; }
    .btn-save-post { background: #1877f2; color: white; }
    .btn-cancel-post { background: #e4e6e9; color: #050505; }
    .post-media img, .post-media video { width: 100%; max-height: 500px; object-fit: cover; }
    .post-actions { display: flex; align-items: center; padding: 8px 16px; border-top: 1px solid #e4e6e9; gap: 12px; }
    .action-btn { background: none; border: none; padding: 8px 12px; cursor: pointer; color: #65676b; }
    .action-btn:hover { background: #f0f2f5; border-radius: 4px; }
    .action-btn.liked { color: #f44336; }
    .report-btn { color: #f44336; }
    .report-btn:hover { background: #fee; }
    .post-controls { margin-left: auto; display: flex; align-items: center; gap: 4px; }
    .visibility-wrapper { position: relative; }
    .visibility { font-size: 11px; color: #999; }
    .visibility.clickable { cursor: pointer; color: #1877f2; font-weight: 500; padding: 4px 8px; border-radius: 4px; transition: background 0.2s; }
    .visibility.clickable:hover { background: #f0f2f5; }
    .visibility-dropdown { position: absolute; right: 0; bottom: 100%; margin-bottom: 4px; background: white; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); min-width: 180px; z-index: 10; }
    .visibility-dropdown button { display: block; width: 100%; padding: 10px 16px; border: none; background: none; text-align: left; cursor: pointer; font-size: 14px; }
    .visibility-dropdown button:hover { background: #f0f2f5; }
    .visibility-dropdown button:first-child { border-radius: 8px 8px 0 0; }
    .visibility-dropdown button:last-child { border-radius: 0 0 8px 8px; }
    .action-icon-btn { background: none; border: none; padding: 4px 8px; cursor: pointer; font-size: 16px; border-radius: 4px; transition: background 0.2s; }
    .action-icon-btn:hover { background: #f0f2f5; }

    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
    .report-modal, .visibility-modal, .edit-modal { background: white; padding: 24px; border-radius: 12px; width: 90%; max-width: 400px; }
    .report-modal h3, .visibility-modal h3, .edit-modal h3 { margin: 0 0 16px; }
    .report-modal select, .report-modal textarea, .visibility-modal select, .edit-modal textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 12px; font-family: inherit; box-sizing: border-box; }
    .current-visibility { font-size: 14px; color: #65676b; margin-bottom: 12px; }
    .modal-actions { display: flex; gap: 12px; }
    .btn-cancel { flex: 1; padding: 12px; border: 1px solid #ddd; background: white; border-radius: 8px; cursor: pointer; }
    .btn-submit { flex: 1; padding: 12px; border: none; background: #1877f2; color: white; border-radius: 8px; cursor: pointer; }
    .btn-submit:disabled { background: #ccc; }

    .comments-section { border-top: 1px solid #e4e6e9; padding: 16px; background: #f0f2f5; }
    .comment-input { display: flex; gap: 8px; margin-bottom: 16px; }
    .comment-input input { flex: 1; padding: 10px 12px; border: 1px solid #ddd; border-radius: 20px; font-family: inherit; }
    .btn-submit-comment { padding: 10px 20px; border: none; background: #1877f2; color: white; border-radius: 20px; cursor: pointer; font-weight: 600; }
    .btn-submit-comment:disabled { background: #ccc; cursor: not-allowed; }
    .loading { text-align: center; color: #65676b; padding: 16px; }
    .no-comments { text-align: center; color: #999; padding: 16px; font-size: 14px; }
    .comments-list { display: flex; flex-direction: column; gap: 12px; }
    .comment { background: white; padding: 12px; border-radius: 8px; }
    .comment-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .comment-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #42b72a, #1877f2); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0; }
    .comment-info { display: flex; flex-direction: column; }
    .comment-username { font-weight: 600; font-size: 14px; }
    .comment-timestamp { font-size: 11px; color: #65676b; }
    .comment-content { font-size: 14px; line-height: 1.4; white-space: pre-wrap; margin-bottom: 8px; }
    .comment-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .comment-like-btn, .comment-action-btn { background: none; border: none; padding: 4px 8px; cursor: pointer; color: #65676b; font-size: 13px; border-radius: 4px; }
    .comment-like-btn:hover, .comment-action-btn:hover { background: #f0f2f5; }
    .comment-like-btn.liked { color: #f44336; }
    .comment-edit { margin-bottom: 8px; }
    .comment-edit input { width: 100%; padding: 8px 12px; border: 1px solid #1877f2; border-radius: 8px; font-family: inherit; font-size: 14px; box-sizing: border-box; }
    .comment-edit-actions { display: flex; gap: 8px; margin-top: 8px; }
    .btn-save-comment, .btn-cancel-comment { padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; }
    .btn-save-comment { background: #1877f2; color: white; }
    .btn-cancel-comment { background: #e4e6e9; color: #050505; }
  `]
})
export class PostCardComponent {
  @Input() post!: Post;
  @Input() currentUid?: number;
  @Output() like = new EventEmitter<Post>();
  @Output() unlike = new EventEmitter<Post>();
  @Output() delete = new EventEmitter<Post>();

  private reportService = inject(ReportService);
  private feedService = inject(FeedService);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  isLiked = false;
  showReportModal = false;
  showVisibilityModal = false;
  showVisibilityDropdown = false;
  editingPost = false;
  reportCategory = 'hate_speech';
  reportReason = '';
  newVisibility = '';
  editPostContent = '';
  showComments = false;
  comments: Comment[] = [];
  newComment = '';
  loadingComments = false;
  editingCommentId: number | null = null;
  editCommentContent = '';

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

  openVisibilityModal(): void {
    this.newVisibility = this.post.visibility;
    this.showVisibilityModal = true;
  }

  updateVisibility(): void {
    if (this.newVisibility && this.newVisibility !== this.post.visibility) {
      this.feedService.updatePostVisibility(this.post.post_id, this.newVisibility).subscribe({
        next: () => {
          this.showVisibilityModal = false;
        },
        error: () => {
          alert('Fehler beim Ändern der Sichtbarkeit');
        }
      });
    } else {
      this.showVisibilityModal = false;
    }
  }

  toggleVisibilityDropdown(event: Event): void {
    event.stopPropagation();
    this.showVisibilityDropdown = !this.showVisibilityDropdown;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    // Close visibility dropdown when clicking outside
    if (this.showVisibilityDropdown) {
      this.showVisibilityDropdown = false;
    }
  }

  changeVisibility(newVisibility: string): void {
    if (newVisibility !== this.post.visibility) {
      this.feedService.updatePostVisibility(this.post.post_id, newVisibility).subscribe({
        next: () => {
          this.post.visibility = newVisibility;
          this.showVisibilityDropdown = false;
        },
        error: () => {
          alert('Fehler beim Ändern der Sichtbarkeit');
          this.showVisibilityDropdown = false;
        }
      });
    } else {
      this.showVisibilityDropdown = false;
    }
  }

  startEditPost(): void {
    this.editPostContent = this.post.content;
    this.editingPost = true;
  }

  cancelEditPost(): void {
    this.editingPost = false;
    this.editPostContent = '';
  }

  updatePostContent(): void {
    const content = this.editPostContent.trim();
    if (!content) return;

    this.feedService.updatePostContent(this.post.post_id, content).subscribe({
      next: (updatedPost) => {
        this.post.content = updatedPost.content;
        this.editingPost = false;
        this.editPostContent = '';
      },
      error: () => {
        alert('Fehler beim Bearbeiten des Posts');
      }
    });
  }

  startEditComment(comment: Comment): void {
    this.editingCommentId = comment.comment_id;
    this.editCommentContent = comment.content;
  }

  cancelCommentEdit(): void {
    this.editingCommentId = null;
    this.editCommentContent = '';
  }

  saveCommentEdit(comment: Comment): void {
    const content = this.editCommentContent.trim();
    if (!content) return;

    this.feedService.updateComment(this.post.author_uid, this.post.post_id, comment.comment_id, content).subscribe({
      next: (updatedComment) => {
        comment.content = updatedComment.content;
        this.editingCommentId = null;
        this.editCommentContent = '';
      },
      error: () => {
        alert('Fehler beim Bearbeiten des Kommentars');
      }
    });
  }

  deleteCommentConfirm(comment: Comment): void {
    if (confirm('Kommentar wirklich löschen?')) {
      this.feedService.deleteComment(this.post.author_uid, this.post.post_id, comment.comment_id).subscribe({
        next: () => {
          this.comments = this.comments.filter(c => c.comment_id !== comment.comment_id);
          this.post.comments_count = Math.max(0, this.post.comments_count - 1);
        },
        error: () => {
          alert('Fehler beim Löschen des Kommentars');
        }
      });
    }
  }

  isImage(url: string): boolean { return /\.(jpg|jpeg|png|gif|webp)$/i.test(url); }
  isVideo(url: string): boolean { return /\.(mp4|webm|mov)$/i.test(url); }
  
  getVisibilityLabel(): string {
    const labels: Record<string, string> = {
      public: '🌍 Öffentlich',
      acquaintance: '👋 Bekannte',
      friends: '👥 Alle Freunde',
      close_friends: '💚 Enge Freunde',
      close_friend: '💚 Enge Freunde',
      family: '👨‍👩‍👧‍👦 Familie',
      private: '🔒 Privat'
    };
    return labels[this.post.visibility] || this.post.visibility;
  }

  toggleComments(): void {
    this.showComments = !this.showComments;
    if (this.showComments && this.comments.length === 0) {
      this.loadComments();
    }
  }

  loadComments(): void {
    this.loadingComments = true;
    this.feedService.getComments(this.post.author_uid, this.post.post_id).subscribe({
      next: (response) => {
        this.comments = response.comments;
        this.loadingComments = false;
      },
      error: () => {
        alert('Fehler beim Laden der Kommentare');
        this.loadingComments = false;
      }
    });
  }

  addComment(): void {
    const content = this.newComment.trim();
    if (!content) return;

    this.feedService.addComment(this.post.author_uid, this.post.post_id, content).subscribe({
      next: (comment) => {
        this.comments.push(comment);
        this.post.comments_count++;
        this.newComment = '';
      },
      error: () => {
        alert('Fehler beim Hinzufügen des Kommentars');
      }
    });
  }

  toggleCommentLike(comment: Comment): void {
    const isLiked = comment.is_liked_by_user;

    if (isLiked) {
      this.feedService.unlikeComment(this.post.author_uid, this.post.post_id, comment.comment_id).subscribe({
        next: () => {
          comment.is_liked_by_user = false;
          comment.likes_count = Math.max(0, comment.likes_count - 1);
        },
        error: () => alert('Fehler beim Entfernen des Likes')
      });
    } else {
      this.feedService.likeComment(this.post.author_uid, this.post.post_id, comment.comment_id).subscribe({
        next: () => {
          comment.is_liked_by_user = true;
          comment.likes_count++;
        },
        error: () => alert('Fehler beim Liken des Kommentars')
      });
    }
  }

  getContentWithHashtags(): SafeHtml {
    // Parse content and make hashtags clickable
    const content = this.post.content || '';
    // Match hashtags: # followed by letters only (no numbers)
    const hashtagRegex = /#([a-zA-ZäöüÄÖÜß]+)/g;
    const result = '<p>' + content.replace(hashtagRegex, '<span class="hashtag" data-hashtag="$1">#$1</span>') + '</p>';
    return this.sanitizer.bypassSecurityTrustHtml(result);
  }

  handleContentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('hashtag')) {
      event.preventDefault();
      event.stopPropagation();
      const hashtag = target.getAttribute('data-hashtag');
      if (hashtag) {
        this.router.navigate(['/hashtag', hashtag]);
      }
    }
  }
}
