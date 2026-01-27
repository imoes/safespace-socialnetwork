import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { I18nService } from './i18n.service';

export interface Notification {
  notification_id: number;
  user_uid: number;
  actor_uid: number;
  actor_username: string;
  actor_profile_picture?: string;
  type: string;
  post_id?: number;
  post_author_uid?: number;
  comment_id?: number;
  is_read: boolean;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private readonly API_URL = '/api/notifications';
  private i18n = inject(I18nService);

  // Signals
  private notificationsSignal = signal<Notification[]>([]);
  private unreadCountSignal = signal<number>(0);
  private isLoadingSignal = signal(false);

  // Computed
  readonly notifications = computed(() => this.notificationsSignal());
  readonly unreadCount = computed(() => this.unreadCountSignal());
  readonly isLoading = computed(() => this.isLoadingSignal());

  constructor(private http: HttpClient) {}

  /**
   * Lädt alle Benachrichtigungen
   */
  loadNotifications(unreadOnly: boolean = false): void {
    this.isLoadingSignal.set(true);

    const options = unreadOnly ? { params: { unread_only: 'true' } } : {};

    this.http.get<{ notifications: Notification[] }>(this.API_URL, options).subscribe({
      next: (response) => {
        this.notificationsSignal.set(response.notifications);
        this.isLoadingSignal.set(false);
      },
      error: () => this.isLoadingSignal.set(false)
    });
  }

  /**
   * Lädt die Anzahl ungelesener Benachrichtigungen
   */
  loadUnreadCount(): void {
    this.http.get<{ count: number }>(`${this.API_URL}/unread-count`).subscribe({
      next: (response) => {
        console.log('📊 Loaded unread count from backend:', response.count);
        this.unreadCountSignal.set(response.count);
      },
      error: (err) => console.error('Error loading unread count:', err)
    });
  }

  /**
   * Markiert eine Benachrichtigung als gelesen
   */
  markAsRead(notificationId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/${notificationId}/read`, {}).pipe(
      tap(() => {
        // Notification in Liste aktualisieren
        this.notificationsSignal.update(notifications =>
          notifications.map(n =>
            n.notification_id === notificationId ? { ...n, is_read: true } : n
          )
        );
        // Unread count aktualisieren
        this.unreadCountSignal.update(count => Math.max(0, count - 1));
      })
    );
  }

  /**
   * Markiert alle Benachrichtigungen als gelesen
   */
  markAllAsRead(): Observable<any> {
    return this.http.post(`${this.API_URL}/mark-all-read`, {}).pipe(
      tap(() => {
        // Alle Notifications als gelesen markieren
        this.notificationsSignal.update(notifications =>
          notifications.map(n => ({ ...n, is_read: true }))
        );
        // Unread count auf 0 setzen
        this.unreadCountSignal.set(0);
      })
    );
  }

  /**
   * Löscht eine Benachrichtigung
   */
  deleteNotification(notificationId: number): Observable<any> {
    console.log('🗑️ Deleting notification', notificationId);
    console.log('Current notifications:', this.notificationsSignal());
    console.log('Current unread count:', this.unreadCountSignal());

    return this.http.delete(`${this.API_URL}/${notificationId}`).pipe(
      tap(() => {
        // Notification aus Liste entfernen
        const notification = this.notificationsSignal().find(
          n => n.notification_id === notificationId
        );

        console.log('Found notification to delete:', notification);
        const wasUnread = notification && !notification.is_read;
        console.log('Was unread?', wasUnread);

        this.notificationsSignal.update(notifications =>
          notifications.filter(n => n.notification_id !== notificationId)
        );

        console.log('After removal, notifications:', this.notificationsSignal());

        // Unread count aktualisieren wenn Notification ungelesen war
        if (wasUnread) {
          console.log('Decrementing unread count');
          this.unreadCountSignal.update(count => {
            const newCount = Math.max(0, count - 1);
            console.log('Unread count updated from', count, 'to', newCount);
            return newCount;
          });
        } else {
          console.log('Not decrementing unread count (notification was already read or not found)');
        }

        console.log('Final unread count:', this.unreadCountSignal());
      })
    );
  }

  /**
   * Gibt die Nachricht für eine Benachrichtigung zurück
   */
  getNotificationMessage(notification: Notification): string {
    switch (notification.type) {
      case 'post_liked':
        return this.i18n.t('notifications.postLiked').replace('{{username}}', notification.actor_username);
      case 'post_commented':
        return this.i18n.t('notifications.postCommented').replace('{{username}}', notification.actor_username);
      case 'comment_liked':
        return this.i18n.t('notifications.commentLiked').replace('{{username}}', notification.actor_username);
      case 'group_post':
        return this.i18n.t('notifications.groupPost').replace('{{username}}', notification.actor_username);
      default:
        return this.i18n.t('notifications.newNotification');
    }
  }
}
