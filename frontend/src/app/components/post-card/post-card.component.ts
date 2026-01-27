import { Component, Input, Output, EventEmitter, inject, HostListener, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Post, FeedService, Comment } from '../../services/feed.service';
import { ReportService } from '../../services/report.service';
import { TranslationService, TranslationResult } from '../../services/translation.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="post-card">
      <div class="post-header">
        @if (post.author_profile_picture) {
          <img [src]="post.author_profile_picture" class="avatar avatar-img clickable-avatar" [alt]="post.author_username" (click)="goToProfile(post.author_uid)" />
        } @else {
          <div class="avatar clickable-avatar" (click)="goToProfile(post.author_uid)">{{ post.author_username.charAt(0).toUpperCase() }}</div>
        }
        <div class="author-info">
          @if (post.recipient_username) {
            <span class="username personal-post-header">
              <span class="clickable-username" (click)="goToProfile(post.recipient_uid!)">{{ post.recipient_username }}</span>
              <span class="arrow">›</span>
              <span class="clickable-username" (click)="goToProfile(post.author_uid)">{{ post.author_username }}</span>
            </span>
          } @else {
            <span class="username clickable-username" (click)="goToProfile(post.author_uid)">{{ post.author_username }}</span>
          }
          <span class="timestamp">{{ post.created_at | date:'dd.MM.yyyy HH:mm' }}</span>
        </div>
      </div>

      @if (editingPost) {
        <div class="post-edit">
          <textarea [(ngModel)]="editPostContent" [placeholder]="'post.editPlaceholder' | translate" rows="5"></textarea>
          <div class="post-edit-actions">
            <button class="btn-save-post" (click)="updatePostContent()">💾 {{ 'post.save' | translate }}</button>
            <button class="btn-cancel-post" (click)="cancelEditPost()">❌ {{ 'post.cancel' | translate }}</button>
          </div>
        </div>
      } @else {
        @if (showTranslation && translatedContent) {
          <div class="post-content translation">
            <div class="translation-label">
              <span class="translation-badge">{{ translationService.getLanguageFlag(translatedContent.detected_language) }} → {{ translationService.getLanguageFlag(translatedContent.target_language) }}</span>
              <span class="translation-info">{{ 'post.translated' | translate }}</span>
            </div>
            <p>{{ translatedContent.translated_text }}</p>
          </div>
        } @else {
          <div class="post-content" [innerHTML]="getContentWithHashtags()" (click)="handleContentClick($event)"></div>
        }
      }

      @if (post.media_urls.length > 0) {
        <div class="post-media">
          @for (url of post.media_urls; track url) {
            @if (isImage(url)) { <img [src]="url" alt="Media" /> }
            @else if (isVideo(url)) {
              <video
                #videoElement
                [src]="url"
                controls
                muted
                playsinline
                preload="metadata"
                (mouseenter)="onVideoHover(videoElement, true)"
                (mouseleave)="onVideoHover(videoElement, false)">
              </video>
            }
          }
        </div>
      }

      <div class="post-actions">
        <button class="action-btn" [class.liked]="isLiked" (click)="toggleLike()">{{ isLiked ? '❤️' : '🤍' }} {{ post.likes_count }}</button>
        <button class="action-btn" (click)="toggleComments()">💬 {{ post.comments_count }}</button>
        <button class="action-btn" (click)="toggleTranslation()" [disabled]="translating">
          {{ showTranslation ? '📝' : '🌐' }} {{ translating ? ('post.translating' | translate) : (showTranslation ? ('post.original' | translate) : ('post.translate' | translate)) }}
        </button>
        @if (post.author_uid === currentUid) {
          <div class="post-controls">
            <button class="action-icon-btn" (click)="startEditPost()" [title]="'post.edit' | translate">✏️</button>
            <button class="action-icon-btn" (click)="onDelete()" [title]="'post.delete' | translate">🗑️</button>
            <div class="visibility-wrapper" #visibilityWrapper>
              <span class="visibility clickable" (click)="toggleVisibilityDropdown($event)" [title]="'post.changeVisibility' | translate">{{ getVisibilityLabel() }}</span>
              @if (showVisibilityDropdown) {
                <div class="visibility-dropdown">
                  <button (click)="changeVisibility('public')">🌍 {{ 'visibility.public' | translate }}</button>
                  <button (click)="changeVisibility('friends')">👥 {{ 'visibility.friends' | translate }}</button>
                  <button (click)="changeVisibility('close_friends')">💚 {{ 'visibility.closeFriends' | translate }}</button>
                  <button (click)="changeVisibility('family')">👨‍👩‍👧‍👦 {{ 'visibility.family' | translate }}</button>
                  <button (click)="changeVisibility('private')">🔒 {{ 'visibility.private' | translate }}</button>
                </div>
              }
            </div>
          </div>
        } @else {
          <div class="post-controls">
            <button class="action-btn report-btn" (click)="showReportModal = true" [title]="'post.report' | translate">🚨</button>
            <span class="visibility">{{ getVisibilityLabel() }}</span>
          </div>
        }
      </div>

      @if (showComments) {
        <div class="comments-section">
          <div class="comment-input">
            <input type="text" [(ngModel)]="newComment" [placeholder]="'post.commentPlaceholder' | translate" (keyup.enter)="addComment()" />
            <button class="btn-submit-comment" (click)="addComment()" [disabled]="!newComment.trim()">{{ 'post.send' | translate }}</button>
          </div>

          @if (loadingComments) {
            <div class="loading">{{ 'post.loadingComments' | translate }}</div>
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
                        <button class="btn-save-comment" (click)="saveCommentEdit(comment)">💾 {{ 'post.save' | translate }}</button>
                        <button class="btn-cancel-comment" (click)="cancelCommentEdit()">❌ {{ 'post.cancel' | translate }}</button>
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
                      <button class="comment-action-btn" (click)="startEditComment(comment)">✏️ {{ 'post.edit' | translate }}</button>
                      <button class="comment-action-btn" (click)="deleteCommentConfirm(comment)">🗑️ {{ 'post.delete' | translate }}</button>
                    }
                  </div>
                </div>
              }
            </div>
          } @else if (!loadingComments) {
            <div class="no-comments">{{ 'post.noComments' | translate }}</div>
          }
        </div>
      }

      @if (showReportModal) {
        <div class="modal-overlay" (click)="showReportModal = false">
          <div class="report-modal" (click)="$event.stopPropagation()">
            <h3>🚨 {{ 'post.reportTitle' | translate }}</h3>
            <select [(ngModel)]="reportCategory">
              <option value="hate_speech">{{ 'report.hateSpeech' | translate }}</option>
              <option value="harassment">{{ 'report.harassment' | translate }}</option>
              <option value="spam">{{ 'report.spam' | translate }}</option>
              <option value="inappropriate">{{ 'report.inappropriate' | translate }}</option>
              <option value="other">{{ 'report.other' | translate }}</option>
            </select>
            <textarea [(ngModel)]="reportReason" [placeholder]="'post.reportPlaceholder' | translate" rows="3"></textarea>
            <div class="modal-actions">
              <button class="btn-cancel" (click)="showReportModal = false">{{ 'post.cancel' | translate }}</button>
              <button class="btn-submit" (click)="submitReport()" [disabled]="!reportReason">{{ 'post.report' | translate }}</button>
            </div>
          </div>
        </div>
      }

      @if (showVisibilityModal) {
        <div class="modal-overlay" (click)="showVisibilityModal = false">
          <div class="visibility-modal" (click)="$event.stopPropagation()">
            <h3>👁️ {{ 'post.visibilityTitle' | translate }}</h3>
            <p class="current-visibility">{{ 'post.currentVisibility' | translate }} <strong>{{ getVisibilityLabel() }}</strong></p>
            <select [(ngModel)]="newVisibility">
              <option value="public">🌍 {{ 'visibility.public' | translate }}</option>
              <option value="friends">👥 {{ 'visibility.friends' | translate }}</option>
              <option value="close_friends">💚 {{ 'visibility.closeFriends' | translate }}</option>
              <option value="family">👨‍👩‍👧‍👦 {{ 'visibility.family' | translate }}</option>
              <option value="private">🔒 {{ 'visibility.private' | translate }}</option>
            </select>
            <div class="modal-actions">
              <button class="btn-cancel" (click)="showVisibilityModal = false">{{ 'post.cancel' | translate }}</button>
              <button class="btn-submit" (click)="updateVisibility()">{{ 'post.save' | translate }}</button>
            </div>
          </div>
        </div>
      }

      <!-- Guardian Modal für Kommentare -->
      @if (showGuardianModal) {
        <div class="modal-overlay" (click)="closeGuardianModal()">
          <div class="guardian-modal" (click)="$event.stopPropagation()">
            <div class="guardian-header">
              <span class="guardian-icon">🛡️</span>
              <h2>{{ 'guardian.title' | translate }}</h2>
            </div>

            @if (guardianResult) {
              <div class="guardian-content">
                <div class="explanation-box">
                  <h3>{{ 'guardian.whyFlagged' | translate }}</h3>
                  <p>{{ guardianResult.explanation }}</p>

                  @if (guardianResult.categories && guardianResult.categories.length > 0) {
                    <div class="categories">
                      <strong>{{ 'guardian.categories' | translate }}</strong>
                      @for (cat of guardianResult.categories; track cat) {
                        <span class="category-tag">{{ getCategoryLabel(cat) }}</span>
                      }
                    </div>
                  }
                </div>

                @if (guardianResult.revision_explanation) {
                  <div class="revision-explanation-box">
                    <h3>{{ 'guardian.whyAlternative' | translate }}</h3>
                    <p>{{ guardianResult.revision_explanation }}</p>
                  </div>
                }

                <div class="alternatives-section">
                  <h3>{{ 'guardian.alternatives' | translate }}</h3>
                  <p class="alternatives-hint">{{ 'guardian.alternativesHint' | translate }}</p>

                  @for (alt of getAlternatives(); track alt; let i = $index) {
                    <button class="alternative-btn" (click)="useAlternative(alt)" [disabled]="isSubmittingComment">
                      <span class="alt-number">{{ i + 1 }}.</span>
                      {{ alt }}
                    </button>
                  }

                  <div class="custom-alternative">
                    <label>{{ 'guardian.customLabel' | translate }}</label>
                    <textarea [(ngModel)]="customContent" rows="3" [placeholder]="'guardian.customPlaceholder' | translate" [disabled]="isSubmittingComment"></textarea>
                    <button class="use-custom-btn" (click)="useCustomContent()" [disabled]="!customContent.trim() || isSubmittingComment">
                      {{ 'guardian.useCustom' | translate }}
                    </button>
                  </div>
                </div>

                <div class="guardian-actions">
                  <button class="dispute-btn" (click)="disputeModeration()">
                    {{ 'guardian.dispute' | translate }}
                  </button>
                  <button class="cancel-btn" (click)="closeGuardianModal()">
                    {{ 'guardian.cancel' | translate }}
                  </button>
                </div>

                <div class="guardian-disclaimer">
                  {{ 'guardian.disclaimer' | translate }}
                </div>
              </div>
            }
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
    .clickable-username { cursor: pointer; }
    .clickable-username:hover { text-decoration: underline; color: #1877f2; }
    .clickable-avatar { cursor: pointer; transition: opacity 0.2s; }
    .clickable-avatar:hover { opacity: 0.8; }
    .personal-post-header .arrow { color: #1877f2; font-weight: bold; margin: 0 4px; }
    .timestamp { font-size: 12px; color: #65676b; }
    .post-content { padding: 0 16px 12px; }
    .post-content p { margin: 0; line-height: 1.5; white-space: pre-wrap; }
    .post-content ::ng-deep .hashtag { color: #1877f2; cursor: pointer; font-weight: 500; text-decoration: none; }
    .post-content ::ng-deep .hashtag:hover { text-decoration: underline; }
    .post-content.translation { background: #f0f8ff; border-left: 3px solid #1877f2; padding: 12px 16px; margin: 0 16px 12px; border-radius: 6px; }
    .translation-label { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 12px; color: #65676b; }
    .translation-badge { font-size: 14px; }
    .translation-info { font-weight: 500; }
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

    /* Guardian Modal */
    .guardian-modal { background: white; border-radius: 16px; width: 90%; max-width: 700px; max-height: 90vh; overflow-y: auto; }
    .guardian-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; border-radius: 16px 16px 0 0; display: flex; align-items: center; gap: 12px; }
    .guardian-icon { font-size: 32px; }
    .guardian-header h2 { margin: 0; font-size: 24px; font-weight: 700; }
    .guardian-content { padding: 24px; }

    .explanation-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
    .explanation-box h3 { margin: 0 0 12px; font-size: 18px; color: #856404; }
    .explanation-box p { margin: 0 0 12px; color: #856404; line-height: 1.6; }
    .categories { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .category-tag { background: #dc3545; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }

    .revision-explanation-box { background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
    .revision-explanation-box h3 { margin: 0 0 12px; font-size: 18px; color: #0c5460; }
    .revision-explanation-box p { margin: 0; color: #0c5460; line-height: 1.6; }

    .alternatives-section h3 { margin: 0 0 8px; font-size: 18px; }
    .alternatives-hint { color: #666; font-size: 14px; margin-bottom: 16px; }
    .alternative-btn { display: block; width: 100%; text-align: left; padding: 16px; background: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s; font-size: 15px; }
    .alternative-btn:hover { background: #e7f3ff; border-color: #1877f2; }
    .alt-number { display: inline-block; background: #1877f2; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; margin-right: 8px; font-weight: bold; font-size: 13px; }

    .custom-alternative { margin-top: 20px; padding-top: 20px; border-top: 2px dashed #dee2e6; }
    .custom-alternative label { display: block; font-weight: 600; margin-bottom: 8px; }
    .custom-alternative textarea { width: 100%; padding: 12px; border: 2px solid #dee2e6; border-radius: 8px; font-family: inherit; font-size: 14px; box-sizing: border-box; }
    .custom-alternative textarea:focus { outline: none; border-color: #1877f2; }
    .use-custom-btn { margin-top: 12px; background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .use-custom-btn:disabled { background: #ccc; cursor: not-allowed; }

    .guardian-actions { display: flex; gap: 12px; margin-top: 24px; padding-top: 24px; border-top: 1px solid #dee2e6; }
    .dispute-btn { flex: 1; background: #ffc107; color: #000; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .dispute-btn:hover { background: #ffb300; }
    .cancel-btn { flex: 1; background: #6c757d; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; }
    .cancel-btn:hover { background: #5a6268; }

    .guardian-disclaimer { background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 8px; margin-top: 16px; font-size: 13px; color: #856404; }
    .guardian-disclaimer strong { font-weight: 600; }

    @media (max-width: 1024px) {
      .post-actions { flex-wrap: wrap; gap: 8px; padding: 8px 12px; }
      .action-btn { padding: 6px 8px; font-size: 13px; }
      .post-controls { margin-left: 0; width: 100%; justify-content: flex-end; }
      .post-header { padding: 10px 12px; }
      .post-content { padding: 0 12px 10px; }
      .comments-section { padding: 12px; }
      .comment-input { flex-direction: column; }
      .comment-input input { width: 100%; }
      .guardian-modal { width: 95%; max-width: none; }
      .guardian-content { padding: 16px; }
      .guardian-header { padding: 16px; }
      .guardian-header h2 { font-size: 18px; }
    }
  `]
})
export class PostCardComponent implements OnChanges {
  @Input() post!: Post;
  @Input() currentUid?: number;
  @Input() expandComments: boolean = false;
  @Output() like = new EventEmitter<Post>();
  @Output() unlike = new EventEmitter<Post>();
  @Output() delete = new EventEmitter<Post>();

  private reportService = inject(ReportService);
  private feedService = inject(FeedService);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  translationService = inject(TranslationService);
  private i18n = inject(I18nService);

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
  showTranslation = false;
  translating = false;
  translatedContent: TranslationResult | null = null;

  // Guardian Modal für Kommentare
  showGuardianModal = false;
  guardianResult: any = null;
  customContent = '';
  originalCommentContent = '';
  isSubmittingComment = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['expandComments'] && this.expandComments) {
      if (!this.showComments) {
        this.showComments = true;
        if (this.comments.length === 0) {
          this.loadComments();
        }
      }
    }
  }

  goToProfile(uid: number): void {
    this.router.navigate(['/profile', uid]);
  }

  toggleLike(): void {
    this.isLiked ? this.unlike.emit(this.post) : this.like.emit(this.post);
    this.isLiked = !this.isLiked;
  }

  onDelete(): void {
    this.delete.emit(this.post);
  }

  submitReport(): void {
    this.reportService.reportPost({
      post_id: this.post.post_id,
      post_author_uid: this.post.author_uid,
      reason: this.reportReason,
      category: this.reportCategory
    }).subscribe({
      next: () => {
        alert(this.i18n.t('post.reportSuccess'));
        this.showReportModal = false;
        this.reportReason = '';
      },
      error: () => alert(this.i18n.t('errors.report'))
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
          alert(this.i18n.t('errors.changeVisibility'));
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
          alert(this.i18n.t('errors.changeVisibility'));
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
        alert(this.i18n.t('errors.editPost'));
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
        alert(this.i18n.t('errors.editComment'));
      }
    });
  }

  deleteCommentConfirm(comment: Comment): void {
    this.feedService.deleteComment(this.post.author_uid, this.post.post_id, comment.comment_id).subscribe({
      next: () => {
        this.comments = this.comments.filter(c => c.comment_id !== comment.comment_id);
        this.post.comments_count = Math.max(0, this.post.comments_count - 1);
      },
      error: () => {
        alert(this.i18n.t('errors.deleteComment'));
      }
    });
  }

  isImage(url: string): boolean { return /\.(jpg|jpeg|png|gif|webp)$/i.test(url); }
  isVideo(url: string): boolean { return /\.(mp4|webm|mov)$/i.test(url); }
  
  getVisibilityLabel(): string {
    const emojiMap: Record<string, string> = {
      public: '🌍',
      acquaintance: '👋',
      friends: '👥',
      close_friends: '💚',
      close_friend: '💚',
      family: '👨‍👩‍👧‍👦',
      private: '🔒'
    };
    const emoji = emojiMap[this.post.visibility] || '';
    const label = this.i18n.t('visibility.' + this.post.visibility);
    return emoji ? `${emoji} ${label}` : label;
  }

  toggleComments(): void {
    this.showComments = !this.showComments;
    if (this.showComments && this.comments.length === 0) {
      this.loadComments();
    }
  }

  toggleTranslation(): void {
    if (this.showTranslation) {
      // Zurück zum Original
      this.showTranslation = false;
    } else {
      // Übersetzen (falls noch nicht übersetzt)
      if (!this.translatedContent) {
        this.translatePost();
      } else {
        this.showTranslation = true;
      }
    }
  }

  translatePost(): void {
    this.translating = true;
    // Translate to user's selected language
    const targetLang = this.i18n.currentLanguage()?.code || 'en';
    this.translationService.translateText(this.post.content, targetLang, 'auto').subscribe({
      next: (result) => {
        this.translatedContent = result;
        this.showTranslation = true;
        this.translating = false;
      },
      error: () => {
        alert(this.i18n.t('common.error'));
        this.translating = false;
      }
    });
  }

  loadComments(): void {
    this.loadingComments = true;
    this.feedService.getComments(this.post.author_uid, this.post.post_id).subscribe({
      next: (response) => {
        this.comments = response.comments;
        this.loadingComments = false;
      },
      error: () => {
        alert(this.i18n.t('errors.loadComments'));
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
      error: (error) => {
        const errorDetail = error.error?.detail || error.error;

        if (error.status === 400 && errorDetail?.error === 'comment_contains_hate_speech') {
          this.originalCommentContent = content;
          this.guardianResult = errorDetail;
          this.showGuardianModal = true;
        } else {
          alert(this.i18n.t('errors.addComment'));
        }
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
        error: () => alert(this.i18n.t('errors.commentUnlike'))
      });
    } else {
      this.feedService.likeComment(this.post.author_uid, this.post.post_id, comment.comment_id).subscribe({
        next: () => {
          comment.is_liked_by_user = true;
          comment.likes_count++;
        },
        error: () => alert(this.i18n.t('errors.commentLike'))
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

  onVideoHover(videoElement: HTMLVideoElement, isHovering: boolean): void {
    if (isHovering) {
      videoElement.play().catch(() => {});
    } else {
      videoElement.pause();
      videoElement.currentTime = 0;
    }
  }

  // Guardian Modal Methods
  closeGuardianModal(): void {
    this.showGuardianModal = false;
    this.guardianResult = null;
    this.customContent = '';
    this.isSubmittingComment = false;
  }

  getAlternatives(): string[] {
    if (!this.guardianResult) return [];
    const alternatives = [];
    if (this.guardianResult.suggested_revision) {
      alternatives.push(this.guardianResult.suggested_revision);
    }
    if (this.guardianResult.alternative_suggestions && Array.isArray(this.guardianResult.alternative_suggestions)) {
      alternatives.push(...this.guardianResult.alternative_suggestions);
    }
    return alternatives;
  }

  useAlternative(alt: string): void {
    // Alternative direkt senden ohne erneuten Check
    this.submitCommentDirectly(alt);
  }

  useCustomContent(): void {
    if (this.customContent.trim()) {
      // Eigene Formulierung direkt senden
      this.submitCommentDirectly(this.customContent);
    }
  }

  submitCommentDirectly(content: string): void {
    // Verhindere Doppelklicks
    if (this.isSubmittingComment) {
      return;
    }

    this.isSubmittingComment = true;

    // Direkt senden ohne Guardian Modal zu triggern
    this.feedService.addComment(this.post.author_uid, this.post.post_id, content).subscribe({
      next: (comment) => {
        this.comments.push(comment);
        this.post.comments_count++;
        this.newComment = '';
        this.isSubmittingComment = false;
        this.closeGuardianModal();
      },
      error: (error) => {
        this.isSubmittingComment = false;

        // Falls auch die Alternative abgelehnt wird (sehr selten)
        const errorDetail = error.error?.detail || error.error;
        if (error.status === 400 && errorDetail?.error === 'comment_contains_hate_speech') {
          // Zeige Guardian erneut
          this.guardianResult = errorDetail;
          this.customContent = '';
        } else {
          alert(this.i18n.t('errors.sendComment'));
          this.closeGuardianModal();
        }
      }
    });
  }

  disputeModeration(): void {
    const reason = prompt(this.i18n.t('post.disputePrompt'));
    if (!reason) return;

    alert(this.i18n.t('post.disputeSuccess'));
    this.closeGuardianModal();
  }

  getCategoryLabel(category: string): string {
    const keyMap: Record<string, string> = {
      'racism': 'categories.racism',
      'sexism': 'categories.sexism',
      'homophobia': 'categories.homophobia',
      'religious_hate': 'categories.religiousHate',
      'disability_hate': 'categories.disabilityHate',
      'xenophobia': 'categories.xenophobia',
      'general_hate': 'categories.generalHate',
      'threat': 'categories.threat',
      'harassment': 'categories.harassment',
      'none': 'categories.none'
    };
    const key = keyMap[category];
    return key ? this.i18n.t(key) : category;
  }
}
