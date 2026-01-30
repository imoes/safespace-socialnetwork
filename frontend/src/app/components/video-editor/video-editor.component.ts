import { Component, signal, computed, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { I18nService } from '../../services/i18n.service';

interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  size: number;
  name: string;
}

@Component({
  selector: 'app-video-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './video-editor.component.html',
  styleUrls: ['./video-editor.component.css']
})
export class VideoEditorComponent {
  @Output() videoProcessed = new EventEmitter<File>();
  @Output() cancelled = new EventEmitter<void>();

  i18n = inject(I18nService);

  private ffmpeg: FFmpeg | null = null;
  private ffmpegLoaded = false;

  // State
  showEditor = signal(false);
  videoFile = signal<File | null>(null);
  videoUrl = signal<string | null>(null);
  videoInfo = signal<VideoInfo | null>(null);

  // Trim controls
  trimStart = signal(0);
  trimEnd = signal(0);
  currentTime = signal(0);

  // Processing
  isProcessing = signal(false);
  processingProgress = signal(0);
  errorMessage = signal<string | null>(null);

  // Codec selection
  selectedCodec = signal<'h264' | 'copy'>('copy');

  // Computed
  duration = computed(() => this.videoInfo()?.duration || 0);
  trimmedDuration = computed(() => this.trimEnd() - this.trimStart());
  isTrimOnly = computed(() => {
    const info = this.videoInfo();
    if (!info) return false;
    return this.trimStart() > 0 || this.trimEnd() < info.duration;
  });
  canProcess = computed(() => {
    const trimmed = this.trimmedDuration();
    return trimmed > 0 && trimmed <= 300; // Max 5 Minuten
  });

  async openEditor(file: File): Promise<void> {
    this.errorMessage.set(null);

    // Validiere Dateityp
    if (!file.type.startsWith('video/')) {
      this.errorMessage.set(this.i18n.t('videoEditor.selectVideoFile'));
      return;
    }

    this.videoFile.set(file);

    // Erstelle Vorschau-URL
    const url = URL.createObjectURL(file);
    this.videoUrl.set(url);

    // Lade Video-Metadaten (separate URL to avoid revoking the preview)
    await this.loadVideoMetadata(file);

    this.showEditor.set(true);

    // FFmpeg im Hintergrund laden
    if (!this.ffmpegLoaded) {
      this.loadFFmpeg();
    }
  }

  private async loadVideoMetadata(file: File): Promise<void> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const metadataUrl = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        const duration = video.duration;

        // Max 5 Minuten Validierung
        if (duration > 300) {
          this.errorMessage.set(this.i18n.t('videoEditor.videoTooLong'));
        }

        this.videoInfo.set({
          duration,
          width: video.videoWidth,
          height: video.videoHeight,
          size: file.size,
          name: file.name
        });

        this.trimStart.set(0);
        this.trimEnd.set(Math.min(duration, 300)); // Max 5 Min

        URL.revokeObjectURL(metadataUrl);
        resolve();
      };

      video.src = metadataUrl;
    });
  }

  private async loadFFmpeg(): Promise<void> {
    try {
      this.ffmpeg = new FFmpeg();

      this.ffmpeg.on('log', ({ message }: { message: string }) => {
        console.log('[FFmpeg]', message);
      });

      this.ffmpeg.on('progress', ({ progress }: { progress: number }) => {
        this.processingProgress.set(Math.round(progress * 100));
      });

      // Serve the ESM worker from /assets/ffmpeg/ (copied via angular.json assets).
      // The worker must be a real URL (not blob) so native import() works inside it.
      // The ESM worker uses native import() to load ffmpeg-core, unlike the UMD
      // bundle which uses webpack's require() that can't resolve URLs.
      const coreBaseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await this.ffmpeg.load({
        coreURL: `${coreBaseURL}/ffmpeg-core.js`,
        wasmURL: `${coreBaseURL}/ffmpeg-core.wasm`,
        classWorkerURL: '/assets/ffmpeg/worker.js',
      });

      this.ffmpegLoaded = true;
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      this.errorMessage.set(this.i18n.t('videoEditor.ffmpegError'));
    }
  }

  async processVideo(): Promise<void> {
    if (!this.canProcess() || !this.videoFile() || !this.ffmpeg) {
      return;
    }

    this.isProcessing.set(true);
    this.errorMessage.set(null);
    this.processingProgress.set(0);

    try {
      if (!this.ffmpegLoaded) {
        await this.loadFFmpeg();
      }

      const file = this.videoFile()!;
      const inputName = 'input.mp4';
      const outputName = 'output.mp4';

      // Schreibe Input-Datei
      await this.ffmpeg!.writeFile(inputName, await fetchFile(file));

      const start = this.trimStart();
      const duration = this.trimmedDuration();
      const useCopy = this.selectedCodec() === 'copy';

      let args: string[];

      if (useCopy) {
        // Stream-Copy: kein Re-Encoding, extrem schnell
        args = [
          '-ss', start.toString(),
          '-i', inputName,
          '-t', duration.toString(),
          '-c', 'copy',
          '-movflags', '+faststart',
          outputName
        ];
      } else {
        // H.264 Re-Encoding mit Optimierungen für WASM-Performance
        const info = this.videoInfo();
        const needsScale = info && info.height > 720;

        args = [
          '-ss', start.toString(),
          '-i', inputName,
          '-t', duration.toString(),
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '28',
          ...(needsScale ? ['-vf', 'scale=-2:720'] : []),
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          outputName
        ];
      }

      console.log('FFmpeg args:', args);
      await this.ffmpeg!.exec(args);

      // Lese Output-Datei
      const data = await this.ffmpeg!.readFile(outputName);
      const blob = new Blob([data], { type: 'video/mp4' });
      const processedFile = new File([blob], file.name, { type: 'video/mp4' });

      // Cleanup
      await this.ffmpeg!.deleteFile(inputName);
      await this.ffmpeg!.deleteFile(outputName);

      // Emit processed file
      this.videoProcessed.emit(processedFile);
      this.closeEditor();
    } catch (error) {
      console.error('Video processing error:', error);
      this.errorMessage.set(this.i18n.t('videoEditor.processingError'));
    } finally {
      this.isProcessing.set(false);
      this.processingProgress.set(0);
    }
  }

  onVideoTimeUpdate(event: Event): void {
    const video = event.target as HTMLVideoElement;
    this.currentTime.set(video.currentTime);
  }

  setTrimStart(): void {
    this.trimStart.set(this.currentTime());
  }

  setTrimEnd(): void {
    this.trimEnd.set(this.currentTime());
  }

  seekTo(time: number): void {
    const video = document.querySelector('video') as HTMLVideoElement;
    if (video) {
      video.currentTime = time;
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatSize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }

  closeEditor(): void {
    if (this.videoUrl()) {
      URL.revokeObjectURL(this.videoUrl()!);
    }
    this.showEditor.set(false);
    this.videoFile.set(null);
    this.videoUrl.set(null);
    this.videoInfo.set(null);
    this.errorMessage.set(null);
  }

  cancel(): void {
    this.closeEditor();
    this.cancelled.emit();
  }
}
