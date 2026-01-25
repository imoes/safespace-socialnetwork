import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationsService, Notification } from '../../services/notifications.service';
import { interval } from 'rxjs';

@Component({
  selector: 'app-notifications-dropdown',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notifications-container">
      <button class="notifications-button" (click)="toggleDropdown()">
        🔔 Benachrichtigungen
        @if (notificationsService.unreadCount() > 0) {
          <span class="notification-badge">{{ notificationsService.unreadCount() }}</span>
        }
      </button>

      @if (showDropdown()) {
        <div class="dropdown-overlay" (click)="closeDropdown()"></div>
        <div class="dropdown-menu">
          <div class="dropdown-header">
            <h3>Benachrichtigungen</h3>
            @if (notificationsService.unreadCount() > 0) {
              <button class="mark-all-read" (click)="markAllAsRead()">Alle als gelesen</button>
            }
          </div>

          <div class="notifications-list">
            @if (notificationsService.isLoading()) {
              <div class="loading">Lade Benachrichtigungen...</div>
            } @else if (notificationsService.notifications().length === 0) {
              <div class="no-notifications">Keine Benachrichtigungen</div>
            } @else {
              @for (notification of notificationsService.notifications(); track notification.notification_id) {
                <div
                  class="notification-item"
                  [class.unread]="!notification.is_read"
                  (click)="handleNotificationClick(notification)"
                >
                  <div class="notification-avatar">
                    @if (notification.actor_profile_picture) {
                      <img [src]="notification.actor_profile_picture" [alt]="notification.actor_username" />
                    } @else {
                      <div class="avatar-placeholder">{{ notification.actor_username.charAt(0).toUpperCase() }}</div>
                    }
                  </div>
                  <div class="notification-content">
                    <div class="notification-message">
                      {{ notificationsService.getNotificationMessage(notification) }}
                    </div>
                    <div class="notification-time">{{ formatTime(notification.created_at) }}</div>
                  </div>
                  @if (!notification.is_read) {
                    <div class="unread-dot"></div>
                  }
                </div>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .notifications-container { position: relative; }

    .notifications-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: none;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      color: #666;
      transition: background 0.2s;
      position: relative;
    }
    .notifications-button:hover { background: #f0f2f5; }

    .notification-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      background: #e74c3c;
      color: white;
      border-radius: 10px;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: bold;
      min-width: 18px;
      text-align: center;
      line-height: 14px;
    }

    .dropdown-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 999;
    }

    .dropdown-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 8px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      width: 400px;
      max-height: 500px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
    }

    .dropdown-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid #e4e6e9;
    }

    .dropdown-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #050505;
    }

    .mark-all-read {
      background: none;
      border: none;
      color: #1877f2;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;
    }
    .mark-all-read:hover { background: #e7f3ff; }

    .notifications-list {
      overflow-y: auto;
      max-height: 400px;
    }

    .loading, .no-notifications {
      text-align: center;
      padding: 24px;
      color: #65676b;
      font-size: 14px;
    }

    .notification-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.2s;
      position: relative;
    }
    .notification-item:hover { background: #f0f2f5; }
    .notification-item.unread { background: #e7f3ff; }
    .notification-item.unread:hover { background: #d8ebff; }

    .notification-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
    }
    .notification-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .avatar-placeholder {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #1877f2, #42b72a);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 18px;
    }

    .notification-content {
      flex: 1;
      min-width: 0;
    }

    .notification-message {
      font-size: 14px;
      color: #050505;
      line-height: 1.4;
    }

    .notification-time {
      font-size: 12px;
      color: #65676b;
      margin-top: 4px;
    }

    .unread-dot {
      width: 10px;
      height: 10px;
      background: #1877f2;
      border-radius: 50%;
      flex-shrink: 0;
    }
  `]
})
export class NotificationsDropdownComponent implements OnInit {
  notificationsService = inject(NotificationsService);
  private router = inject(Router);

  showDropdown = signal(false);

  ngOnInit(): void {
    // Initial load
    this.notificationsService.loadUnreadCount();

    // Refresh every 30 seconds
    interval(30000).subscribe(() => {
      this.notificationsService.loadUnreadCount();
      if (this.showDropdown()) {
        this.notificationsService.loadNotifications();
      }
    });
  }

  toggleDropdown(): void {
    this.showDropdown.update(v => !v);

    // Load notifications when opening dropdown
    if (this.showDropdown()) {
      this.notificationsService.loadNotifications();
    }
  }

  closeDropdown(): void {
    this.showDropdown.set(false);
  }

  markAllAsRead(): void {
    this.notificationsService.markAllAsRead().subscribe({
      next: () => {
        console.log('All notifications marked as read');
      },
      error: (err) => {
        console.error('Error marking all as read:', err);
      }
    });
  }

  handleNotificationClick(notification: Notification): void {
    console.log('Notification clicked:', notification);

    // Close dropdown first
    this.closeDropdown();

    // Navigate based on notification type
    if (notification.post_id && notification.post_author_uid) {
      // Navigate first
      this.router.navigate(['/my-posts'], {
        queryParams: { highlight: notification.post_id }
      }).then(() => {
        // After navigation, mark as read and delete
        if (!notification.is_read) {
          this.notificationsService.markAsRead(notification.notification_id).subscribe({
            next: () => {
              console.log('Marked as read, now deleting...');
              // Nach dem Markieren als gelesen, Benachrichtigung löschen
              this.notificationsService.deleteNotification(notification.notification_id).subscribe({
                next: () => console.log('Notification deleted'),
                error: (err) => console.error('Delete error:', err)
              });
            },
            error: (err) => console.error('Mark as read error:', err)
          });
        } else {
          // Bereits gelesene Benachrichtigung direkt löschen
          console.log('Already read, deleting...');
          this.notificationsService.deleteNotification(notification.notification_id).subscribe({
            next: () => console.log('Notification deleted'),
            error: (err) => console.error('Delete error:', err)
          });
        }
      });
    }
  }

  formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Gerade eben';
    } else if (diffMins < 60) {
      return `vor ${diffMins} Min.`;
    } else if (diffHours < 24) {
      return `vor ${diffHours} Std.`;
    } else if (diffDays < 7) {
      return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
    } else {
      return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  }
}
