import { Component, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeedService, Post } from '../../services/feed.service';
import { AuthService } from '../../services/auth.service';
import { SafeSpaceService, ModerationCheckResult } from '../../services/safespace.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-create-post',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="create-post">
      <div class="post-header">
        <div class="avatar">{{ authService.currentUser()?.username?.charAt(0)?.toUpperCase() }}</div>
        <textarea [(ngModel)]="content" placeholder="Was denkst du gerade?" rows="3" [disabled]="isSubmitting()"></textarea>
      </div>

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

        <button class="post-btn" (click)="submitPost()" [disabled]="!canPost() || isSubmitting()">
          {{ isSubmitting() ? '...' : 'Posten' }}
        </button>
      </div>
    </div>

    <!-- Guardian Modal -->
    @if (showGuardianModal) {
      <div class="modal-overlay" (click)="closeGuardianModal()">
        <div class="guardian-modal" (click)="$event.stopPropagation()">
          <div class="guardian-header">
            <span class="guardian-icon">🛡️</span>
            <h2>Guardian - AI-gestützte Inhaltsmoderation</h2>
          </div>

          @if (guardianResult) {
            <div class="guardian-content">
              <div class="explanation-box">
                <h3>Warum wurde dieser Inhalt markiert?</h3>
                <p>{{ guardianResult.explanation }}</p>

                @if (guardianResult.categories && guardianResult.categories.length > 0) {
                  <div class="categories">
                    <strong>Kategorien:</strong>
                    @for (cat of guardianResult.categories; track cat) {
                      <span class="category-tag">{{ getCategoryLabel(cat) }}</span>
                    }
                  </div>
                }
              </div>

              <div class="alternatives-section">
                <h3>Alternative Formulierungen</h3>
                <p class="alternatives-hint">Wähle eine der folgenden Alternativen oder formuliere deinen Inhalt selbst um:</p>

                @for (alt of getAlternatives(); track alt; let i = $index) {
                  <button class="alternative-btn" (click)="useAlternative(alt)">
                    <span class="alt-number">{{ i + 1 }}.</span>
                    {{ alt }}
                  </button>
                }

                <div class="custom-alternative">
                  <label>Oder schreibe eine eigene Formulierung:</label>
                  <textarea [(ngModel)]="customContent" rows="3" placeholder="Deine eigene Formulierung..."></textarea>
                  <button class="use-custom-btn" (click)="useCustomContent()" [disabled]="!customContent.trim()">
                    Eigene Formulierung verwenden
                  </button>
                </div>
              </div>

              <div class="guardian-actions">
                <button class="dispute-btn" (click)="disputeModeration()">
                  ⚖️ Widerspruch einlegen
                </button>
                <button class="cancel-btn" (click)="closeGuardianModal()">
                  Abbrechen
                </button>
              </div>

              <div class="guardian-disclaimer">
                ⚠️ <strong>Hinweis:</strong> KI-Systeme können Fehler machen. Alle Vorschläge sind ohne Gewähr.
                Bei Unklarheiten kannst du Widerspruch einlegen.
              </div>
            </div>
          }
        </div>
      </div>
    }
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

    /* Guardian Modal */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
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
  `]
})
export class CreatePostComponent {
  @Output() postCreated = new EventEmitter<Post>();
  feedService = inject(FeedService);
  authService = inject(AuthService);
  safeSpace = inject(SafeSpaceService);
  http = inject(HttpClient);

  content = '';
  visibility = 'friends';
  selectedFiles = signal<File[]>([]);
  isSubmitting = signal(false);

  showGuardianModal = false;
  guardianResult: ModerationCheckResult | null = null;
  customContent = '';

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

    // Guardian-Prüfung VOR dem Posten
    if (this.content.trim()) {
      this.isSubmitting.set(true);
      this.safeSpace.checkContent(this.content).subscribe({
        next: (result) => {
          this.isSubmitting.set(false);
          if (result.is_hate_speech) {
            // Zeige Guardian Modal
            this.guardianResult = result;
            this.showGuardianModal = true;
          } else {
            // Kein Problem erkannt, direkt posten
            this.actuallySubmitPost();
          }
        },
        error: () => {
          this.isSubmitting.set(false);
          // Bei Fehler in der Prüfung: Trotzdem posten
          this.actuallySubmitPost();
        }
      });
    } else {
      // Nur Medien, keine Textprüfung nötig
      this.actuallySubmitPost();
    }
  }

  actuallySubmitPost(): void {
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
        this.isSubmitting.set(false);
      },
      error: () => { this.isSubmitting.set(false); alert('Fehler beim Posten!'); }
    });
  }

  getAlternatives(): string[] {
    if (!this.guardianResult) return [];
    const alts = [];
    if (this.guardianResult.suggested_revision) {
      alts.push(this.guardianResult.suggested_revision);
    }
    if (this.guardianResult.alternative_suggestions) {
      alts.push(...this.guardianResult.alternative_suggestions);
    }
    return alts.slice(0, 2); // Maximal 2 Alternativen
  }

  useAlternative(alternative: string): void {
    this.content = alternative;
    this.closeGuardianModal();
    this.actuallySubmitPost();
  }

  useCustomContent(): void {
    this.content = this.customContent;
    this.customContent = '';
    this.closeGuardianModal();
    // Erneut prüfen
    this.submitPost();
  }

  disputeModeration(): void {
    if (!this.guardianResult) return;

    this.http.post('/api/safespace/dispute', {
      content: this.content,
      reason: 'User hat Widerspruch gegen die Moderation eingelegt'
    }).subscribe({
      next: () => {
        alert('Dein Widerspruch wurde zur Prüfung durch einen Moderator weitergeleitet.');
        this.closeGuardianModal();
      },
      error: () => {
        alert('Fehler beim Einreichen des Widerspruchs.');
      }
    });
  }

  closeGuardianModal(): void {
    this.showGuardianModal = false;
    this.guardianResult = null;
    this.customContent = '';
  }

  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      racism: 'Rassismus',
      sexism: 'Sexismus',
      homophobia: 'Homophobie',
      religious_hate: 'Religiöse Hetze',
      disability_hate: 'Ableismus',
      xenophobia: 'Fremdenfeindlichkeit',
      general_hate: 'Hassrede',
      threat: 'Drohung',
      harassment: 'Belästigung',
      none: 'Keine'
    };
    return labels[category] || category;
  }
}
