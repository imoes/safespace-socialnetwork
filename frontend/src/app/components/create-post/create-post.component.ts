import { Component, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeedService, Post } from '../../services/feed.service';
import { AuthService } from '../../services/auth.service';
import { SafeSpaceService } from '../../services/safespace.service';
import { debounceTime, Subject } from 'rxjs';

@Component({
  selector: 'app-create-post',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="create-post">
      <div class="post-header">
        <div class="avatar">{{ authService.currentUser()?.username?.charAt(0)?.toUpperCase() }}</div>
        <textarea [(ngModel)]="content" placeholder="Was denkst du gerade?" rows="3" [disabled]="isSubmitting()" (ngModelChange)="onContentChange($event)"></textarea>
      </div>

      <!-- SafeSpace Warnung -->
      @if (safeSpace.checkResult(); as result) {
        @if (result.is_hate_speech) {
          <div class="safespace-warning" [style.borderColor]="safeSpace.getScoreColor(result.confidence_score)">
            <div class="warning-header">
              <span class="warning-icon">⚠️</span>
              <strong>SafeSpace Hinweis</strong>
              <span class="confidence">{{ (result.confidence_score * 100).toFixed(0) }}% sicher</span>
            </div>
            <p class="explanation">{{ result.explanation }}</p>
            
            @if (result.categories.length > 0) {
              <div class="categories">
                @for (cat of result.categories; track cat) {
                  <span class="category-tag">{{ safeSpace.getCategoryLabel(cat) }}</span>
                }
              </div>
            }
            
            @if (result.suggested_revision) {
              <div class="suggestion">
                <strong>💡 Vorschlag:</strong>
                <p>{{ result.suggested_revision }}</p>
                <button class="use-suggestion" (click)="useSuggestion(result.suggested_revision)">
                  Vorschlag übernehmen
                </button>
              </div>
            }
          </div>
        }
      }

      @if (selectedFiles().length > 0) {
        <div class="file-preview">
          @for (file of selectedFiles(); track file.name) {
            <div class="preview-item">{{ file.name }} <button (click)="removeFile(file)">×</button></div>
          }
        </div>
      }

      <div class="post-footer">
        <label class="media-btn">📷<input type="file" accept="image/*" multiple (change)="onFileSelect($event)" hidden /></label>
        <label class="media-btn">🎥<input type="file" accept="video/*" (change)="onFileSelect($event)" hidden /></label>
        <select [(ngModel)]="visibility">
          <option value="public">🌍 Öffentlich</option>
          <option value="friends">👥 Alle Freunde</option>
          <option value="close_friends">💚 Enge Freunde</option>
          <option value="family">👨‍👩‍👧‍👦 Familie</option>
          <option value="private">🔒 Nur ich</option>
        </select>
        
        @if (safeSpace.checking()) {
          <span class="checking">🔍 Prüfe...</span>
        }
        
        <button class="post-btn" (click)="submitPost()" [disabled]="!canPost() || isSubmitting()">
          {{ isSubmitting() ? '...' : 'Posten' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .create-post { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 16px; margin-bottom: 20px; }
    .post-header { display: flex; gap: 12px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #1877f2, #42b72a); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; }
    textarea { flex: 1; border: none; resize: none; font-size: 16px; outline: none; }
    .file-preview { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .preview-item { background: #f0f2f5; padding: 4px 10px; border-radius: 12px; font-size: 12px; }
    .post-footer { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #eee; }
    .media-btn { padding: 8px; cursor: pointer; }
    .media-btn:hover { background: #f0f2f5; border-radius: 4px; }
    select { padding: 6px; border: 1px solid #ddd; border-radius: 4px; }
    .post-btn { margin-left: auto; background: #1877f2; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
    .post-btn:disabled { background: #ccc; }
    .checking { font-size: 12px; color: #666; }
    
    /* SafeSpace Styling */
    .safespace-warning {
      margin-top: 12px;
      padding: 12px;
      border-left: 4px solid #f44336;
      background: #fff3e0;
      border-radius: 0 8px 8px 0;
    }
    .warning-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .warning-icon { font-size: 20px; }
    .confidence {
      margin-left: auto;
      font-size: 12px;
      background: rgba(0,0,0,0.1);
      padding: 2px 8px;
      border-radius: 12px;
    }
    .explanation { margin: 8px 0; color: #666; font-size: 14px; }
    .categories { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
    .category-tag {
      background: #ffcdd2;
      color: #c62828;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
    }
    .suggestion {
      margin-top: 12px;
      padding: 10px;
      background: #e8f5e9;
      border-radius: 6px;
    }
    .suggestion p { margin: 8px 0; font-style: italic; }
    .use-suggestion {
      background: #4caf50;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    .use-suggestion:hover { background: #43a047; }
  `]
})
export class CreatePostComponent {
  @Output() postCreated = new EventEmitter<Post>();
  feedService = inject(FeedService);
  authService = inject(AuthService);
  safeSpace = inject(SafeSpaceService);

  content = '';
  visibility = 'friends';
  selectedFiles = signal<File[]>([]);
  isSubmitting = signal(false);
  
  private contentChange$ = new Subject<string>();

  constructor() {
    // Debounced Content Check
    this.contentChange$.pipe(
      debounceTime(1000)
    ).subscribe(content => {
      if (content.trim().length > 10) {
        this.safeSpace.checkContent(content).subscribe();
      } else {
        this.safeSpace.clearCheckResult();
      }
    });
  }

  onContentChange(content: string): void {
    this.contentChange$.next(content);
  }

  useSuggestion(suggestion: string): void {
    this.content = suggestion;
    this.safeSpace.clearCheckResult();
  }

  canPost(): boolean {
    return this.content.trim().length > 0 || this.selectedFiles().length > 0;
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.selectedFiles.update(files => [...files, ...Array.from(input.files!)]);
    }
  }

  removeFile(file: File): void {
    this.selectedFiles.update(files => files.filter(f => f !== file));
  }

  submitPost(): void {
    if (!this.canPost()) return;
    this.isSubmitting.set(true);

    const files = this.selectedFiles();
    const obs = files.length > 0
      ? this.feedService.createPostWithMedia(this.content, files, this.visibility)
      : this.feedService.createPost(this.content, this.visibility);

    obs.subscribe({
      next: (post) => {
        this.postCreated.emit(post);
        this.content = '';
        this.selectedFiles.set([]);
        this.safeSpace.clearCheckResult();
        this.isSubmitting.set(false);
      },
      error: () => { this.isSubmitting.set(false); alert('Fehler!'); }
    });
  }
}
