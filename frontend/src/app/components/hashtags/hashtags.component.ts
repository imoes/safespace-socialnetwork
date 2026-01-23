import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HashtagService, HashtagStat } from '../../services/hashtag.service';

@Component({
  selector: 'app-hashtags',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="hashtags-container">
      <div class="header">
        <h2>🏷️ Hashtags</h2>
        <p class="subtitle">Entdecke beliebte Themen und suche nach Hashtags</p>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button
          class="tab"
          [class.active]="activeTab() === 'search'"
          (click)="activeTab.set('search')">
          🔍 Suche
        </button>
        <button
          class="tab"
          [class.active]="activeTab() === 'trending'"
          (click)="loadTrending(); activeTab.set('trending')">
          📊 Top 10
        </button>
      </div>

      <!-- Search Tab -->
      @if (activeTab() === 'search') {
        <div class="search-section">
          <div class="search-box">
            <input
              type="text"
              [(ngModel)]="searchQuery"
              (keydown.enter)="searchHashtag()"
              placeholder="#hashtag suchen..."
              class="search-input"
            />
            <button class="search-btn" (click)="searchHashtag()">
              Suchen
            </button>
          </div>
          <p class="search-hint">💡 Tipp: Ein Hashtag beginnt mit # und enthält nur Buchstaben</p>
        </div>
      }

      <!-- Trending Tab -->
      @if (activeTab() === 'trending') {
        <div class="trending-section">
          @if (loading()) {
            <div class="loading">Lade Top Hashtags...</div>
          } @else if (trending().length > 0) {
            <div class="trending-list">
              @for (stat of trending(); track stat.hashtag; let i = $index) {
                <div class="trending-item" (click)="goToHashtag(stat.hashtag)">
                  <div class="rank">{{ i + 1 }}</div>
                  <div class="hashtag-info">
                    <div class="hashtag-name">#{{ stat.hashtag }}</div>
                    <div class="hashtag-count">{{ stat.count }} Posts</div>
                  </div>
                  <div class="arrow">→</div>
                </div>
              }
            </div>
          } @else {
            <div class="empty-state">
              Keine Hashtags gefunden
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .hashtags-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
    }

    .header {
      margin-bottom: 24px;
    }

    h2 {
      margin: 0 0 8px 0;
      color: #333;
      font-size: 28px;
    }

    .subtitle {
      margin: 0;
      color: #666;
      font-size: 14px;
    }

    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      border-bottom: 2px solid #e4e6e9;
    }

    .tab {
      padding: 12px 24px;
      border: none;
      background: none;
      color: #666;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      transition: all 0.2s;
      margin-bottom: -2px;
    }

    .tab:hover {
      color: #1877f2;
    }

    .tab.active {
      color: #1877f2;
      border-bottom-color: #1877f2;
    }

    .search-section, .trending-section {
      background: white;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .search-box {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }

    .search-input {
      flex: 1;
      padding: 12px 16px;
      border: 2px solid #e4e6e9;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      outline: none;
      border-color: #1877f2;
    }

    .search-btn {
      padding: 12px 32px;
      background: #1877f2;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .search-btn:hover {
      background: #166fe5;
    }

    .search-hint {
      color: #65676b;
      font-size: 13px;
      margin: 0;
    }

    .loading, .empty-state {
      text-align: center;
      padding: 40px;
      color: #65676b;
    }

    .trending-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .trending-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .trending-item:hover {
      background: #e4e6e9;
      transform: translateX(4px);
    }

    .rank {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #1877f2, #42b72a);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 18px;
      flex-shrink: 0;
    }

    .hashtag-info {
      flex: 1;
    }

    .hashtag-name {
      font-weight: 600;
      font-size: 18px;
      color: #1877f2;
      margin-bottom: 4px;
    }

    .hashtag-count {
      font-size: 14px;
      color: #65676b;
    }

    .arrow {
      font-size: 24px;
      color: #65676b;
    }
  `]
})
export class HashtagsComponent implements OnInit {
  private hashtagService = inject(HashtagService);
  private router = inject(Router);

  activeTab = signal<'search' | 'trending'>('trending');
  searchQuery = '';
  trending = signal<HashtagStat[]>([]);
  loading = signal(false);

  ngOnInit(): void {
    this.loadTrending();
  }

  loadTrending(): void {
    this.loading.set(true);
    this.hashtagService.getTrendingHashtags(10).subscribe({
      next: (stats) => {
        this.trending.set(stats);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Fehler beim Laden der Trending Hashtags:', err);
        this.loading.set(false);
      }
    });
  }

  searchHashtag(): void {
    let query = this.searchQuery.trim();
    if (!query) return;

    // Remove # if present
    if (query.startsWith('#')) {
      query = query.substring(1);
    }

    // Validate: only letters
    if (!/^[a-zA-ZäöüÄÖÜß]+$/.test(query)) {
      alert('Ein Hashtag darf nur Buchstaben enthalten!');
      return;
    }

    this.goToHashtag(query);
  }

  goToHashtag(hashtag: string): void {
    this.router.navigate(['/hashtag', hashtag]);
  }
}
