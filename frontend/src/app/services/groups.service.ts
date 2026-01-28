import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Group {
  group_id: number;
  name: string;
  description?: string;
  join_mode?: string;
  profile_picture?: string;
  created_by: number;
  created_at: string;
  member_count?: number;
  pending_count?: number;
  my_role?: string | null;
  my_status?: string | null;
}

export interface GroupMember {
  user_uid: number;
  username: string;
  profile_picture?: string;
  role: string;
  joined_at: string;
}

export interface GroupPost {
  post_id: number;
  author_uid: number;
  author_username: string;
  author_profile_picture?: string;
  content: string;
  visibility: string;
  created_at: string;
  group_id: number;
  group_name?: string;
  likes_count: number;
  comments_count: number;
  media_urls?: string[];
}

export interface GroupComment {
  comment_id: number;
  post_id: number;
  user_uid: number;
  username: string;
  profile_picture?: string;
  content: string;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class GroupsService {
  private readonly API_URL = '/api/groups';

  constructor(private http: HttpClient) {}

  getGroups(search?: string): Observable<{ groups: Group[] }> {
    const params: any = {};
    if (search) params.search = search;
    return this.http.get<{ groups: Group[] }>(this.API_URL, { params });
  }

  getMyGroups(): Observable<{ groups: Group[] }> {
    return this.http.get<{ groups: Group[] }>(`${this.API_URL}/my`);
  }

  getGroup(groupId: number): Observable<{ group: Group }> {
    return this.http.get<{ group: Group }>(`${this.API_URL}/${groupId}`);
  }

  createGroup(name: string, description?: string, joinMode: string = 'open'): Observable<{ group: Group }> {
    return this.http.post<{ group: Group }>(this.API_URL, { name, description, join_mode: joinMode });
  }

  deleteGroup(groupId: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/${groupId}`);
  }

  joinGroup(groupId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/${groupId}/join`, {});
  }

  leaveGroup(groupId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/${groupId}/leave`, {});
  }

  getMembers(groupId: number): Observable<{ members: GroupMember[] }> {
    return this.http.get<{ members: GroupMember[] }>(`${this.API_URL}/${groupId}/members`);
  }

  updateMemberRole(groupId: number, userUid: number, role: string): Observable<any> {
    return this.http.put(`${this.API_URL}/${groupId}/members/${userUid}/role`, { role });
  }

  removeMember(groupId: number, userUid: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/${groupId}/members/${userUid}`);
  }

  getPosts(groupId: number, limit = 50, offset = 0): Observable<{ posts: GroupPost[], is_member: boolean }> {
    return this.http.get<{ posts: GroupPost[], is_member: boolean }>(
      `${this.API_URL}/${groupId}/posts`,
      { params: { limit: limit.toString(), offset: offset.toString() } }
    );
  }

  createPost(groupId: number, content: string, visibility: string = 'internal'): Observable<{ post: GroupPost }> {
    return this.http.post<{ post: GroupPost }>(
      `${this.API_URL}/${groupId}/posts`,
      { content, visibility }
    );
  }

  deletePost(groupId: number, postId: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/${groupId}/posts/${postId}`);
  }

  likePost(groupId: number, postId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/${groupId}/posts/${postId}/like`, {});
  }

  unlikePost(groupId: number, postId: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/${groupId}/posts/${postId}/like`);
  }

  getComments(groupId: number, postId: number): Observable<{ comments: GroupComment[] }> {
    return this.http.get<{ comments: GroupComment[] }>(
      `${this.API_URL}/${groupId}/posts/${postId}/comments`
    );
  }

  addComment(groupId: number, postId: number, content: string): Observable<any> {
    return this.http.post(`${this.API_URL}/${groupId}/posts/${postId}/comment`, { content });
  }

  getPendingMembers(groupId: number): Observable<{ pending: GroupMember[] }> {
    return this.http.get<{ pending: GroupMember[] }>(`${this.API_URL}/${groupId}/pending`);
  }

  approveMember(groupId: number, userUid: number): Observable<any> {
    return this.http.post(`${this.API_URL}/${groupId}/approve/${userUid}`, {});
  }

  rejectMember(groupId: number, userUid: number): Observable<any> {
    return this.http.post(`${this.API_URL}/${groupId}/reject/${userUid}`, {});
  }

  updateGroupSettings(groupId: number, joinMode: string): Observable<any> {
    return this.http.put(`${this.API_URL}/${groupId}/settings`, { join_mode: joinMode });
  }

  uploadProfilePicture(groupId: number, file: File): Observable<{ profile_picture: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ profile_picture: string }>(
      `${this.API_URL}/${groupId}/profile-picture`,
      formData
    );
  }

  deleteProfilePicture(groupId: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/${groupId}/profile-picture`);
  }
}
