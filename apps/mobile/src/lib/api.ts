import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { config } from './config';

type AuthErrorHandler = () => void;
let onUnauthorizedCallback: AuthErrorHandler | null = null;

export function setOnUnauthorized(handler: AuthErrorHandler) {
  onUnauthorizedCallback = handler;
}

class ApiClient {
  private client: AxiosInstance;
  private static instance: ApiClient;

  private constructor() {
    this.client = axios.create({
      baseURL: `${config.apiUrl}/api`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - attach token
    this.client.interceptors.request.use(
      async (reqConfig: InternalAxiosRequestConfig) => {
        console.log(`[API Request] ${reqConfig.method?.toUpperCase()} ${reqConfig.baseURL}${reqConfig.url}`);
        const token = await SecureStore.getItemAsync('auth_token');
        if (token && reqConfig.headers) {
          reqConfig.headers.Authorization = `Bearer ${token}`;
        }
        return reqConfig;
      },
      (error) => {
        console.error('[API Request Config Error]', error);
        return Promise.reject(error);
      },
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[API Response] ${response.status} ${response.config.url}`);
        return response;
      },
      async (error: AxiosError<{ success?: boolean; error?: { code?: string; message?: string } }>) => {
        console.warn(`[API Error] ${error.config?.url}:`, error.message, error.response?.data || error.code);
        if (error.response?.status === 401) {
          // Token expired, invalid or authentication required
          await SecureStore.deleteItemAsync('auth_token');
          await SecureStore.deleteItemAsync('auth_expires_at');
          if (onUnauthorizedCallback) {
            onUnauthorizedCallback();
          }
        }
        const serverMsg = error.response?.data?.error?.message;
        if (serverMsg) {
          error.message = serverMsg;
        }
        return Promise.reject(error);
      },
    );
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  get instance() {
    return this.client;
  }

  async checkHealth() {
    const response = await this.client.get('/health');
    return response.data;
  }

  // ---- Auth ----
  async setup(data: {
    username: string;
    email: string;
    password: string;
    displayName: string;
    deviceName?: string;
  }) {
    const response = await this.client.post('/auth/setup', data);
    return response.data;
  }

  async login(data: { email: string; password: string; deviceName?: string }) {
    const response = await this.client.post('/auth/login', data);
    return response.data;
  }

  async register(data: {
    username: string;
    email: string;
    password: string;
    displayName: string;
    invitationToken: string;
    deviceName?: string;
  }) {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    const response = await this.client.post('/auth/change-password', data);
    return response.data;
  }

  async logout() {
    const response = await this.client.post('/auth/logout');
    return response.data;
  }

  async logoutAll() {
    const response = await this.client.post('/auth/logout-all');
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // ---- Invitations ----
  async createInvitation() {
    const response = await this.client.post('/invitations');
    return response.data;
  }

  async validateInvitation(token: string) {
    const response = await this.client.get(`/invitations/validate/${token}`);
    return response.data;
  }

  async getInvitationStatus() {
    const response = await this.client.get('/invitations/status');
    return response.data;
  }

  async revokeInvitation(id: string) {
    const response = await this.client.delete(`/invitations/${id}`);
    return response.data;
  }

  // ---- Users ----
  async updateProfile(data: { displayName?: string; status?: string; username?: string }) {
    const response = await this.client.patch('/users/me', data);
    return response.data;
  }

  async uploadAvatar(uri: string) {
    const formData = new FormData();

    const filename = uri.split('/').pop() || 'avatar.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('avatar', {
      uri,
      name: filename,
      type,
    } as unknown as Blob);

    const response = await this.client.post('/users/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async updateSettings(data: Record<string, boolean | string>) {
    const response = await this.client.patch('/users/me/settings', data);
    return response.data;
  }

  async getPartner() {
    const response = await this.client.get('/users/partner');
    return response.data;
  }

  async deleteAccount() {
    const response = await this.client.delete('/users/me');
    return response.data;
  }

  // ---- Conversations ----
  async getConversations() {
    const response = await this.client.get('/conversations');
    return response.data;
  }

  async getConversation(id: string) {
    const response = await this.client.get(`/conversations/${id}`);
    return response.data;
  }

  async markConversationRead(id: string) {
    const response = await this.client.post(`/conversations/${id}/read`);
    return response.data;
  }

  // ---- Messages ----
  async getMessages(conversationId: string, cursor?: string, limit: number = 50) {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    params.append('limit', limit.toString());

    const response = await this.client.get(
      `/messages/${conversationId}?${params.toString()}`,
    );
    return response.data;
  }

  async sendMessage(
    conversationId: string,
    data: {
      content?: string;
      type?: string;
      replyToId?: string;
      tempId?: string;
    },
  ) {
    const response = await this.client.post(`/messages/${conversationId}`, data);
    return response.data;
  }

  async editMessage(messageId: string, content: string) {
    const response = await this.client.patch(`/messages/${messageId}`, { content });
    return response.data;
  }

  async deleteMessage(messageId: string) {
    const response = await this.client.delete(`/messages/${messageId}`);
    return response.data;
  }

  async toggleReaction(messageId: string, reaction: string, action: 'add' | 'remove') {
    const response = await this.client.post(`/messages/${messageId}/reactions`, {
      reaction,
      action,
    });
    return response.data;
  }

  async markMessageRead(messageId: string) {
    const response = await this.client.post(`/messages/${messageId}/read`);
    return response.data;
  }

  async searchMessages(conversationId: string, query: string) {
    const response = await this.client.get(
      `/messages/search/${conversationId}?q=${encodeURIComponent(query)}`,
    );
    return response.data;
  }

  // ---- Attachments ----
  async uploadAttachment(conversationId: string, uri: string) {
    const formData = new FormData();

    const filename = uri.split('/').pop() || 'image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', {
      uri,
      name: filename,
      type,
    } as unknown as Blob);

    const response = await this.client.post(
      `/attachments/upload/${conversationId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2 minutes for large uploads
      },
    );
    return response.data;
  }

  async getAttachmentUrl(id: string) {
    const response = await this.client.get(`/attachments/${id}/url`);
    return response.data;
  }

  // ---- Sessions ----
  async getSessions() {
    const response = await this.client.get('/sessions');
    return response.data;
  }

  async revokeSession(id: string) {
    const response = await this.client.delete(`/sessions/${id}`);
    return response.data;
  }

  async registerDevice(pushToken: string, platform: string, deviceName: string) {
    const response = await this.client.post('/sessions/devices/register', {
      pushToken,
      platform,
      deviceName,
    });
    return response.data;
  }

  // ---- Calls ----
  async getCallHistory(page: number = 1, limit: number = 20) {
    const response = await this.client.get(`/calls/history?page=${page}&limit=${limit}`);
    return response.data;
  }

  async createCall(conversationId: string, callType: 'voice' | 'video') {
    const response = await this.client.post('/calls', { conversationId, callType });
    return response.data;
  }

  async answerCall(callId: string) {
    const response = await this.client.patch(`/calls/${callId}/answer`);
    return response.data;
  }

  async endCall(callId: string) {
    const response = await this.client.patch(`/calls/${callId}/end`);
    return response.data;
  }

  async declineCall(callId: string) {
    const response = await this.client.patch(`/calls/${callId}/decline`);
    return response.data;
  }

  async getIceServers() {
    const response = await this.client.get('/calls/ice-servers');
    return response.data;
  }

  // ---- Audio Upload ----
  async uploadAudio(conversationId: string, uri: string, duration: number) {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'audio.m4a';
    formData.append('file', {
      uri,
      name: filename,
      type: 'audio/x-m4a',
    } as unknown as Blob);
    formData.append('duration', duration.toString());

    const response = await this.client.post(
      `/attachments/upload/${conversationId}`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      },
    );
    return response.data;
  }
}

export const api = ApiClient.getInstance();
