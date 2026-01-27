import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HashtagService, HashtagStat } from '../../services/hashtag.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { RecentPostsTickerComponent } from '../recent-posts-ticker/recent-posts-ticker.component';

@Component({
  selector: 'app-hashtags',
  standalone: true,
  imports: [CommonModule, FormsModule, RecentPostsTickerComponent],
  template: `
    <app-recent-posts-ticker />
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
          <div class="search-box-container">
            <input
              type="text"
              [(ngModel)]="searchQuery"
              (input)="onSearchInput()"
              (focus)="onSearchFocus()"
              (keydown)="onSearchKeydown($event)"
              placeholder="🔍 Hashtag suchen (mind. 2 Zeichen)..."
              class="search-input"
            />

            @if (showSuggestions() && suggestions().length > 0) {
              <div class="search-overlay" (click)="closeSuggestions()"></div>
              <div class="suggestions-dropdown">
                @for (suggestion of suggestions(); track suggestion.hashtag; let i = $index) {
                  <div
                    class="suggestion-item"
                    [class.selected]="selectedIndex() === i"
                    (click)="selectHashtag(suggestion.hashtag)"
                    (mouseenter)="selectedIndex.set(i)">
                    <div class="suggestion-hashtag">#{{ suggestion.hashtag }}</div>
                    <div class="suggestion-count">{{ suggestion.count }} Posts</div>
                  </div>
                }
              </div>
            }

            @if (showSuggestions() && searchQuery.length >= 2 && suggestions().length === 0 && !loading()) {
              <div class="search-overlay" (click)="closeSuggestions()"></div>
              <div class="suggestions-dropdown">
                <div class="no-results">Keine Hashtags gefunden</div>
              </div>
            }
          </div>
          <p class="search-hint">💡 Tipp: Beginne mit der Eingabe - ab 2 Zeichen werden dir Vorschläge angezeigt</p>
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

    .search-box-container {
      position: relative;
      margin-bottom: 12px;
    }

    .search-input {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e4e6e9;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      outline: none;
      border-color: #1877f2;
    }

    .search-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 999;
    }

    .suggestions-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 8px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-height: 400px;
      overflow-y: auto;
      z-index: 1000;
    }

    .suggestion-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .suggestion-item:hover,
    .suggestion-item.selected {
      background: #f0f2f5;
    }

    .suggestion-hashtag {
      font-weight: 600;
      font-size: 16px;
      color: #1877f2;
    }

    .suggestion-count {
      font-size: 13px;
      color: #65676b;
    }

    .no-results {
      padding: 16px;
      text-align: center;
      color: #65676b;
      font-size: 14px;
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
  suggestions = signal<HashtagStat[]>([]);
  showSuggestions = signal(false);
  selectedIndex = signal(-1);
  loading = signal(false);

  private searchSubject = new Subject<string>();

  constructor() {
    // Debounced autocomplete search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length >= 2) {
          // Remove # if present
          const cleanQuery = query.startsWith('#') ? query.substring(1) : query;
          return this.hashtagService.autocompleteHashtags(cleanQuery, 10);
        }
        return of([]);
      })
    ).subscribe(results => {
      this.suggestions.set(results);
    });
  }

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

  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
    this.selectedIndex.set(-1);
    // Show suggestions if query is long enough
    if (this.searchQuery.length >= 2) {
      this.showSuggestions.set(true);
    } else {
      this.showSuggestions.set(false);
    }
  }

  onSearchFocus(): void {
    if (this.searchQuery.length >= 2) {
      this.showSuggestions.set(true);
      this.searchSubject.next(this.searchQuery);
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const results = this.suggestions();

    if (event.key === 'Escape') {
      this.closeSuggestions();
      return;
    }

    if (results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex.update(i => (i + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex.update(i => (i - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const index = this.selectedIndex();
      if (index >= 0 && index < results.length) {
        this.selectHashtag(results[index].hashtag);
      }
    }
  }

  closeSuggestions(): void {
    this.showSuggestions.set(false);
    this.selectedIndex.set(-1);
  }

  selectHashtag(hashtag: string): void {
    this.closeSuggestions();
    this.searchQuery = '';
    this.suggestions.set([]);
    this.goToHashtag(hashtag);
  }

  goToHashtag(hashtag: string): void {
    this.router.navigate(['/hashtag', hashtag]);
  }
}
