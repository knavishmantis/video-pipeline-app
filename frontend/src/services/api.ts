import axios from 'axios';

export interface FormatTopVideo {
  video_id: string;
  title: string;
  views: number;
  video_url: string | null;
  transcript: string | null;
}

export interface FormatReference {
  id: string;
  name: string;
  description: string;
  avg_views: number;
  top_videos: FormatTopVideo[];
}

export interface LintIssue {
  type: 'error' | 'warning' | 'info';
  check: string;
  message: string;
  matches?: string[];
}
import { User, UserRole, Short, Assignment, File as FileType, Payment, CreateShortInput, UpdateShortInput, CreateAssignmentInput, AuthResponse, UserRate, IncentiveRule, Scene, CreateSceneInput, UpdateSceneInput, PresetClip, CreatePresetClipInput, UpdatePresetClipInput, SampleAssignment, CreateSampleInput } from '../../../shared/types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2 minute timeout (increased for AI grading which can take time)
});

// Request interceptor: Add token and handle FormData Content-Type
api.interceptors.request.use((config) => {
  // If data is FormData, remove Content-Type header to let browser set it with boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  
  // Add token to requests
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  loginWithGoogle: async (googleToken: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { googleToken });
    return response.data;
  },
  getMe: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  checkProfileComplete: async (): Promise<{ complete: boolean; missing: { discord_username?: boolean; paypal_email?: boolean } }> => {
    const response = await api.get('/auth/profile-complete');
    return response.data;
  },
};

export const shortsApi = {
  getAll: async (params?: { status?: string; assigned?: boolean }): Promise<Short[]> => {
    const response = await api.get('/shorts', { params });
    return response.data;
  },
  getAssigned: async (): Promise<Short[]> => {
    const response = await api.get('/shorts/assigned');
    return response.data;
  },
  getById: async (id: number): Promise<Short> => {
    const response = await api.get(`/shorts/${id}`);
    return response.data;
  },
  create: async (input: CreateShortInput): Promise<Short> => {
    const response = await api.post('/shorts', input);
    return response.data;
  },
  update: async (id: number, input: UpdateShortInput): Promise<Short> => {
    const response = await api.put(`/shorts/${id}`, input);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/shorts/${id}`);
  },
  toggleActive: async (id: number): Promise<{ id: number; is_active: boolean }> => {
    const response = await api.patch(`/shorts/${id}/toggle-active`);
    return response.data;
  },
  setScriptSubStage: async (id: number, stage: 'idea' | 'written' | 'scenes' | null): Promise<void> => {
    await api.patch(`/shorts/${id}/script-sub-stage`, { script_sub_stage: stage });
  },
  markClipsComplete: async (id: number): Promise<Short> => {
    const response = await api.post(`/shorts/${id}/mark-clips-complete`);
    return response.data;
  },
  markEditingComplete: async (id: number): Promise<Short> => {
    const response = await api.post(`/shorts/${id}/mark-editing-complete`);
    return response.data;
  },
  getReflectionStats: async (): Promise<{ overdue_count: number }> => {
    const response = await api.get('/shorts/reflection-stats');
    return response.data;
  },
  analyzeScript: async (id: number): Promise<{ issues: LintIssue[] }> => {
    const response = await api.post(`/shorts/${id}/analyze-script`);
    return response.data;
  },
};

export const assignmentsApi = {
  getAll: async (): Promise<Assignment[]> => {
    const response = await api.get('/assignments');
    return response.data;
  },
  getAllPublic: async (): Promise<Assignment[]> => {
    const response = await api.get('/assignments/public');
    return response.data;
  },
  getMyAssignments: async (): Promise<Assignment[]> => {
    const response = await api.get('/assignments/my-assignments');
    return response.data;
  },
  create: async (input: CreateAssignmentInput): Promise<Assignment> => {
    const response = await api.post('/assignments', input);
    return response.data;
  },
  update: async (id: number, updates: Partial<Assignment>): Promise<Assignment> => {
    const response = await api.put(`/assignments/${id}`, updates);
    return response.data;
  },
  markComplete: async (id: number): Promise<Assignment> => {
    const response = await api.post(`/assignments/${id}/complete`);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/assignments/${id}`);
  },
};

export const filesApi = {
  getByShortId: async (shortId: number): Promise<FileType[]> => {
    const response = await api.get(`/files/short/${shortId}`);
    return response.data;
  },
  getSignedUrl: async (fileId: number): Promise<string> => {
    const response = await api.get(`/files/${fileId}/signed-url`);
    return response.data.download_url;
  },
  // Get signed URL for direct upload to GCS
  getUploadUrl: async (
    shortId: number,
    fileType: string,
    fileName: string,
    fileSize: number,
    contentType: string
  ): Promise<{ upload_url: string; bucket_path: string; expires_in: number }> => {
    const response = await api.post('/files/upload-url', {
      short_id: shortId,
      file_type: fileType,
      file_name: fileName,
      file_size: fileSize,
      content_type: contentType,
    });
    return response.data;
  },
  // Upload directly to GCS using signed URL
  uploadDirectToGCS: async (
    uploadUrl: string,
    file: globalThis.File,
    onUploadProgress?: (progressEvent: { loaded: number; total: number }) => void
  ): Promise<void> => {
    // Upload directly to GCS (no timeout - GCS handles it)
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress: onUploadProgress ? (progressEvent) => {
        if (progressEvent.total) {
          onUploadProgress({
            loaded: progressEvent.loaded,
            total: progressEvent.total,
          });
        }
      } : undefined,
      // No timeout - let GCS handle large file uploads
      timeout: 0,
    });
  },
  // Confirm upload completion and save metadata
  confirmUpload: async (
    shortId: number,
    fileType: string,
    bucketPath: string,
    fileName: string,
    fileSize: number,
    mimeType: string
  ): Promise<FileType> => {
    const response = await api.post('/files/confirm-upload', {
      short_id: shortId,
      file_type: fileType,
      bucket_path: bucketPath,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
    });
    return response.data;
  },
  // Legacy upload method (for small files or fallback)
  upload: async (
    shortId: number, 
    fileType: string, 
    file: globalThis.File,
    onUploadProgress?: (progressEvent: { loaded: number; total: number }) => void
  ): Promise<FileType> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('short_id', shortId.toString());
    formData.append('file_type', fileType);
    
    // Calculate timeout based on file size: 
    // - Upload time: 1 minute per 100MB
    // - Server processing time: 5 minutes per 100MB (for GCS upload - can be slow for large files)
    // - Minimum 15 minutes, maximum 120 minutes (2 hours)
    // Note: Cloud Run max is 60 minutes, but we set higher client timeout to handle edge cases
    const fileSizeMB = file.size / (1024 * 1024);
    const uploadTimeMinutes = Math.ceil(fileSizeMB / 100);
    const processingTimeMinutes = Math.ceil(fileSizeMB / 20); // More time for GCS upload (can be slow)
    const totalMinutes = uploadTimeMinutes + processingTimeMinutes;
    const timeoutMinutes = Math.min(120, Math.max(15, totalMinutes)); // Up to 2 hours
    const timeoutMs = timeoutMinutes * 60 * 1000;
    
    const response = await api.post('/files/upload', formData, {
      timeout: timeoutMs,
      onUploadProgress: onUploadProgress ? (progressEvent) => {
        if (progressEvent.total) {
          onUploadProgress({
            loaded: progressEvent.loaded,
            total: progressEvent.total,
          });
        }
      } : undefined,
    });
    return response.data;
  },
  uploadProfilePicture: async (formData: FormData): Promise<{ url: string; gcp_bucket_path: string }> => {
    // Content-Type will be automatically removed by the interceptor for FormData
    const response = await api.post('/files/upload', formData);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/files/${id}`);
  },
};

export interface AnalyzedShort {
  id: number;
  youtube_video_id: string;
  channel_name: string;
  channel_id: string;
  title: string;
  description?: string;
  transcript: string;
  transcript_source?: string;
  views: number;
  likes: number;
  comments: number;
  published_at?: string;
  percentile?: number;
  user_guess_percentile?: number;
  notes?: string;
  reviewed_at?: string;
  review_user_id?: number;
}

export interface ReviewStats {
  last10: {
    count: number;
    avg_error: number;
    min_error: number;
    max_error: number;
  };
  last30: {
    count: number;
    avg_error: number;
    min_error: number;
    max_error: number;
  };
  allTime: {
    count: number;
    avg_error: number;
    min_error: number;
    max_error: number;
  };
  total: number;
  reviewed: number;
}

export interface ReviewResponse {
  actual_percentile: number;
  guess_percentile: number;
  error: number;
  difference: number;
}

export const analyzedShortsApi = {
  getRandomUnrated: async (): Promise<AnalyzedShort> => {
    const response = await api.get('/analyzed-shorts/random-unrated');
    return response.data;
  },
  getById: async (id: number): Promise<AnalyzedShort> => {
    const response = await api.get(`/analyzed-shorts/${id}`);
    return response.data;
  },
  submitReview: async (id: number, guess_percentile: number, notes?: string): Promise<ReviewResponse> => {
    const response = await api.post(`/analyzed-shorts/${id}/review`, { guess_percentile, notes });
    return response.data;
  },
  updateNotes: async (id: number, notes: string): Promise<void> => {
    await api.patch(`/analyzed-shorts/${id}/notes`, { notes });
  },
  getStats: async (): Promise<ReviewStats> => {
    const response = await api.get('/analyzed-shorts/stats');
    return response.data;
  },
};

export const usersApi = {
  getAll: async (params?: { role?: string }): Promise<User[]> => {
    const response = await api.get('/users', { params });
    return response.data;
  },
  getById: async (id: number): Promise<User> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
  create: async (user: { email: string; discord_username?: string; roles: UserRole[] }): Promise<User> => {
    const response = await api.post('/users', user);
    return response.data;
  },
  update: async (id: number, updates: Partial<User>): Promise<User> => {
    const response = await api.put(`/users/${id}`, updates);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
  getUserRates: async (id: number): Promise<UserRate[]> => {
    const response = await api.get(`/users/${id}/rates`);
    return response.data;
  },
  setUserRate: async (id: number, rate: { role: 'clipper' | 'editor'; rate: number; rate_description?: string }): Promise<UserRate> => {
    const response = await api.put(`/users/${id}/rate`, rate);
    return response.data;
  },
  getIncentiveRules: async (id: number): Promise<IncentiveRule[]> => {
    const response = await api.get(`/users/${id}/incentive-rules`);
    return response.data;
  },
  setIncentiveRule: async (id: number, rule: { role: 'clipper' | 'editor'; metric: 'views' | 'subscribers_gained'; threshold: number; amount: number }): Promise<IncentiveRule> => {
    const response = await api.post(`/users/${id}/incentive-rules`, rule);
    return response.data;
  },
  deleteIncentiveRule: async (userId: number, ruleId: number): Promise<void> => {
    await api.delete(`/users/${userId}/incentive-rules/${ruleId}`);
  },
  getSubmissionStats: async (): Promise<Record<number, Record<string, { total: number; completed: number }>>> => {
    const response = await api.get('/users/submission-stats');
    return response.data;
  },
};

export const scenesApi = {
  getAll: async (shortId: number): Promise<Scene[]> => {
    const response = await api.get(`/shorts/${shortId}/scenes`);
    return response.data;
  },
  getById: async (shortId: number, sceneId: number): Promise<Scene> => {
    const response = await api.get(`/shorts/${shortId}/scenes/${sceneId}`);
    return response.data;
  },
  create: async (shortId: number, input: CreateSceneInput): Promise<Scene> => {
    const response = await api.post(`/shorts/${shortId}/scenes`, input);
    return response.data;
  },
  update: async (shortId: number, sceneId: number, input: UpdateSceneInput): Promise<Scene> => {
    const response = await api.put(`/shorts/${shortId}/scenes/${sceneId}`, input);
    return response.data;
  },
  delete: async (shortId: number, sceneId: number): Promise<void> => {
    await api.delete(`/shorts/${shortId}/scenes/${sceneId}`);
  },
  bulkCreate: async (shortId: number, scenes: CreateSceneInput[]): Promise<Scene[]> => {
    const response = await api.post(`/shorts/${shortId}/scenes/bulk`, { scenes });
    return response.data;
  },
  reorder: async (shortId: number, sceneIds: number[]): Promise<Scene[]> => {
    const response = await api.post(`/shorts/${shortId}/scenes/reorder`, { scene_ids: sceneIds });
    return response.data;
  },
  getImageUrl: async (shortId: number, sceneId: number): Promise<string> => {
    const response = await api.get(`/shorts/${shortId}/scenes/${sceneId}/image-url`);
    return response.data.url;
  },
  addImage: async (shortId: number, sceneId: number, bucketPath: string, fileType: 'image' | 'video' = 'image') => {
    const response = await api.post(`/shorts/${shortId}/scenes/${sceneId}/images`, { bucket_path: bucketPath, file_type: fileType });
    return response.data;
  },
  deleteImage: async (shortId: number, sceneId: number, imageId: number): Promise<void> => {
    await api.delete(`/shorts/${shortId}/scenes/${sceneId}/images/${imageId}`);
  },
  getSceneImageUrl: async (shortId: number, sceneId: number, imageId: number): Promise<string> => {
    const response = await api.get(`/shorts/${shortId}/scenes/${sceneId}/images/${imageId}/url`);
    return response.data.url;
  },
  autoLinkGroups: async (shortId: number): Promise<{ applied: { scene_id: number; link_group: string }[] }> => {
    const response = await api.post(`/shorts/${shortId}/scenes/auto-link-groups`);
    return response.data;
  },
  generateSegments: async (shortId: number): Promise<string[]> => {
    const response = await api.post(`/shorts/${shortId}/scenes/generate-segments`);
    return response.data.segments;
  },
};

export const presetClipsApi = {
  getAll: async (): Promise<PresetClip[]> => {
    const response = await api.get('/preset-clips');
    return response.data;
  },
  getById: async (id: number): Promise<PresetClip> => {
    const response = await api.get(`/preset-clips/${id}`);
    return response.data;
  },
  getUploadUrl: async (fileName: string, fileSize: number, contentType: string): Promise<{ upload_url: string; bucket_path: string; expires_in: number }> => {
    const response = await api.post('/preset-clips/upload-url', { file_name: fileName, file_size: fileSize, content_type: contentType });
    return response.data;
  },
  create: async (input: CreatePresetClipInput): Promise<PresetClip> => {
    const response = await api.post('/preset-clips', input);
    return response.data;
  },
  update: async (id: number, input: UpdatePresetClipInput): Promise<PresetClip> => {
    const response = await api.put(`/preset-clips/${id}`, input);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/preset-clips/${id}`);
  },
  getThumbnailUrl: async (id: number): Promise<string> => {
    const response = await api.get(`/preset-clips/${id}/thumbnail-url`);
    return response.data.url;
  },
  getVideoUrl: async (id: number): Promise<string> => {
    const response = await api.get(`/preset-clips/${id}/video-url`);
    return response.data.url;
  },
};

export const teamMetricsApi = {
  get: async (): Promise<any> => {
    const response = await api.get('/team-metrics');
    return response.data;
  },
};

export const pipelineAnalyticsApi = {
  get: async (): Promise<any> => {
    const response = await api.get('/analytics/pipeline');
    return response.data;
  },
};

export interface YouTubeVideoAnalytics {
  video_id: string;
  title: string;
  published_at: string;
  duration_sec: number;
  is_short: boolean;
  views: number;
  likes: number;
  dislikes: number;
  comments: number;
  shares: number;
  estimated_minutes_watched: number;
  average_view_duration: number;
  average_view_percentage: number;
  subscribers_gained: number;
  subscribers_lost: number;
  like_rate: number;
  comment_rate: number;
  share_rate: number;
  sub_gain_rate: number;
  engagement_rate: number;
  fetched_at: string;
}

export const youtubeAnalyticsApi = {
  getAll: async (): Promise<YouTubeVideoAnalytics[]> => {
    const response = await api.get('/youtube-analytics');
    return response.data;
  },
  getPipeline: async (): Promise<any[]> => {
    const response = await api.get('/youtube-analytics/pipeline');
    return response.data;
  },
};

export interface ResearchIdea {
  ideaId: string;
  title: string;
  hook: string;
  whyItFits: string;
  sourceSignal: string;
  sourceType: 'youtube' | 'reddit' | 'minecraft' | 'mixed';
  category: string;
  timeliness: 'evergreen' | 'time_sensitive';
  timeWindow?: string | null;
  contentPoints: string[];
  codeReference?: string;
  sources?: { label: string; url?: string }[];
  score: number;
  createdAt: string;
  acknowledged?: boolean;
}

export interface ResearchBacklog {
  lastUpdated: string | null;
  ideas: ResearchIdea[];
}

export const researchApi = {
  getBacklog: async (): Promise<ResearchBacklog> => {
    const response = await api.get('/research/ideas');
    return response.data;
  },
  acknowledgeIdea: async (ideaId: string): Promise<{ ideaId: string; acknowledged: boolean }> => {
    const response = await api.post(`/research/ideas/${ideaId}/acknowledge`);
    return response.data;
  },
};

export const paymentsApi = {
  getAll: async (params?: { user_id?: number; month?: number; year?: number }): Promise<Payment[]> => {
    const response = await api.get('/payments', { params });
    return response.data;
  },
  getPending: async (params?: { user_id?: number; month?: number; year?: number }): Promise<Payment[]> => {
    const response = await api.get('/payments/pending', { params });
    return response.data;
  },
  getMyPayments: async (params?: { month?: number; year?: number }): Promise<Payment[]> => {
    const response = await api.get('/payments/my-payments', { params });
    return response.data;
  },
  create: async (payment: Partial<Payment>): Promise<Payment> => {
    const response = await api.post('/payments', payment);
    return response.data;
  },
  update: async (id: number, updates: Partial<Payment>): Promise<Payment> => {
    const response = await api.put(`/payments/${id}`, updates);
    return response.data;
  },
  markPaid: async (id: number, paypalTransactionLink: string): Promise<Payment> => {
    const response = await api.post(`/payments/${id}/mark-paid`, { paypal_transaction_link: paypalTransactionLink });
    return response.data;
  },
  addIncentive: async (payment: { user_id: number; short_id?: number; amount: number; description?: string }): Promise<Payment> => {
    const response = await api.post('/payments/incentive', payment);
    return response.data;
  },
  getStats: async (params?: { user_id?: number; month?: number; year?: number }): Promise<any> => {
    const response = await api.get('/payments/stats', { params });
    return response.data;
  },
};

export const scriptEngineApi = {
  getStatus: async (): Promise<any> => {
    const response = await api.get('/script-engine/status');
    return response.data;
  },
  getRuns: async (): Promise<any> => {
    const response = await api.get('/script-engine/runs');
    return response.data;
  },
  getIdeas: async (status?: string): Promise<any> => {
    const response = await api.get('/script-engine/ideas', { params: status ? { status } : {} });
    return response.data;
  },
  getIdea: async (id: number): Promise<any> => {
    const response = await api.get(`/script-engine/ideas/${id}`);
    return response.data;
  },
  getScripts: async (): Promise<any> => {
    const response = await api.get('/script-engine/scripts');
    return response.data;
  },
  getScript: async (id: number): Promise<any> => {
    const response = await api.get(`/script-engine/scripts/${id}`);
    return response.data;
  },
  updateScriptStatus: async (id: number, status: string): Promise<any> => {
    const response = await api.patch(`/script-engine/scripts/${id}/status`, { status });
    return response.data;
  },
  getCritiques: async (decision?: string, humanStatus?: string): Promise<any> => {
    const params: any = {};
    if (decision) params.decision = decision;
    if (humanStatus) params.human_status = humanStatus;
    const response = await api.get('/script-engine/critiques', { params });
    return response.data;
  },
  getCritique: async (id: number): Promise<any> => {
    const response = await api.get(`/script-engine/critiques/${id}`);
    return response.data;
  },
  approveCritique: async (id: number): Promise<any> => {
    const response = await api.patch(`/script-engine/critiques/${id}/approve`);
    return response.data;
  },
  rejectCritique: async (id: number): Promise<any> => {
    const response = await api.patch(`/script-engine/critiques/${id}/reject`);
    return response.data;
  },
  markCritique: async (id: number, human_status: 'used' | 'not_used' | null): Promise<any> => {
    const response = await api.patch(`/script-engine/critiques/${id}/mark`, { human_status });
    return response.data;
  },
  createShortFromCritique: async (critiqueId: number): Promise<Short> => {
    const response = await api.post(`/script-engine/critiques/${critiqueId}/create-short`);
    return response.data;
  },
  createShortFromBrief: async (briefId: number): Promise<Short> => {
    const response = await api.post(`/script-engine/briefs/${briefId}/create-short`);
    return response.data;
  },
  getBriefs: async (opts?: {
    human_status?: 'unreviewed' | 'starred' | 'created' | 'skipped';
    source?: string;
    angle?: string;
    q?: string;
    min_rating?: number;
  }): Promise<any[]> => {
    const response = await api.get('/script-engine/briefs', { params: opts });
    return response.data;
  },
  getBrief: async (id: number): Promise<any> => {
    const response = await api.get(`/script-engine/briefs/${id}`);
    return response.data;
  },
  getBriefCounts: async (): Promise<{
    unreviewed: number; starred: number; created: number; skipped: number; total: number;
    avg_rating_unreviewed: number; high_unreviewed: number; mid_unreviewed: number; low_unreviewed: number;
  }> => {
    const response = await api.get('/script-engine/briefs/counts');
    return response.data;
  },
  markBrief: async (id: number, human_status: 'created' | 'skipped' | 'starred' | null): Promise<any> => {
    const response = await api.patch(`/script-engine/briefs/${id}/mark`, { human_status });
    return response.data;
  },
  getTokenUsage: async (): Promise<{
    by_day: Array<{ day: string; tokens: number; cost_usd: number }>;
    by_task: Array<{ task: string; calls: number; tokens: number; cache_read_tokens: number; cost_usd: number }>;
    totals: { cost_7d: number; cost_24h: number; calls_7d: number };
  }> => {
    const response = await api.get('/script-engine/token-usage');
    return response.data;
  },
  searchIdeasWithBriefs: async (q?: string): Promise<Array<{ id: number; title: string; source: string; status: string; full_brief: string | null; brief_summary: string | null }>> => {
    const response = await api.get('/script-engine/ideas/search', { params: q ? { q } : {} });
    return response.data;
  },
  getCritiqueCounts: async (): Promise<{
    unmarked: number; used: number; not_used: number; total: number;
    avg_score_unmarked: number; high_unmarked: number; mid_unmarked: number; low_unmarked: number;
  }> => {
    const response = await api.get('/script-engine/critiques/counts');
    return response.data;
  },
  getFormatReferences: async (): Promise<FormatReference[]> => {
    const response = await api.get('/script-engine/format-references');
    return response.data;
  },
};

export interface CompetitorReviewData {
  notes?: string;
  percentile_guess?: number;
  rating?: number;
  hook_type?: string;
  topic_category?: string;
  steal_this?: string;
  visual_verbal?: string;
  initial_analysis?: string;
  hook_notes?: string;
  concept_notes?: string;
  pacing_notes?: string;
  payoff_notes?: string;
  emotion?: string;
}

export interface SampleListItem {
  id: number;
  source_short_id: number;
  source_short_title: string;
  prospect_email: string;
  prospect_name: string;
  prospect_discord: string | null;
  created_at: string;
  expires_at: string;
  submitted_at: string | null;
  review_status: 'pending' | 'approved' | 'rejected' | null;
  promoted_at: string | null;
  scene_count: number;
}

export interface SampleDetail extends SampleAssignment {
  source_short_title?: string;
  submission_download_url?: string | null;
}

export const samplesApi = {
  // Admin
  list: async (): Promise<SampleListItem[]> => {
    const response = await api.get('/samples');
    return response.data;
  },
  create: async (input: CreateSampleInput): Promise<SampleDetail> => {
    const response = await api.post('/samples', input);
    return response.data;
  },
  get: async (id: number): Promise<SampleDetail> => {
    const response = await api.get(`/samples/${id}`);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/samples/${id}`);
  },
  setReview: async (id: number, review_status: 'pending' | 'approved' | 'rejected'): Promise<void> => {
    await api.post(`/samples/${id}/review`, { review_status });
  },
  promote: async (id: number): Promise<void> => {
    await api.post(`/samples/${id}/promote`);
  },
  // Sample clipper (prospect)
  getMine: async (): Promise<SampleDetail> => {
    const response = await api.get('/samples/me');
    return response.data;
  },
  getMyUploadUrl: async (
    fileName: string,
    fileSize: number,
    contentType: string
  ): Promise<{ upload_url: string; bucket_path: string; expires_in: number }> => {
    const response = await api.post('/samples/me/upload-url', {
      file_name: fileName,
      file_size: fileSize,
      content_type: contentType,
    });
    return response.data;
  },
  confirmMySubmission: async (
    bucketPath: string,
    fileName: string,
    fileSize: number
  ): Promise<{ success: boolean }> => {
    const response = await api.post('/samples/me/submit', {
      bucket_path: bucketPath,
      file_name: fileName,
      file_size: fileSize,
    });
    return response.data;
  },
  saveMyDiscord: async (discord_username: string): Promise<void> => {
    await api.post('/samples/me/discord', { discord_username });
  },
};

export const formulaGuidesApi = {
  getFlashback: async (): Promise<{ markdown: string; lastUpdated: string | null }> => {
    const response = await api.get('/formula-guides/flashback');
    return response.data;
  },
};

export const competitorAnalysisApi = {
  getChannels: async (): Promise<any[]> => {
    const response = await api.get('/competitor-analysis/channels');
    return response.data;
  },
  getMyShorts: async (): Promise<any[]> => {
    const response = await api.get('/competitor-analysis/my-shorts');
    return response.data;
  },
  getNextVideo: async (channel: string, browse = false): Promise<any> => {
    const response = await api.get(`/competitor-analysis/channels/${encodeURIComponent(channel)}/next${browse ? '?browse=true' : ''}`);
    return response.data;
  },
  getVideoUrl: async (id: string): Promise<string> => {
    // Use backend streaming proxy instead of direct GCS signed URL.
    // iOS Safari requires proper Content-Type + Range request support, which
    // GCS signed URLs don't reliably provide. The proxy handles this correctly.
    const token = localStorage.getItem('token') || '';
    return `${API_URL}/competitor-analysis/videos/${id}/stream?token=${encodeURIComponent(token)}`;
  },
  saveReview: async (id: string, data: CompetitorReviewData): Promise<void> => {
    await api.post(`/competitor-analysis/videos/${id}/review`, data);
  },
  getReveal: async (id: string): Promise<any> => {
    const response = await api.get(`/competitor-analysis/videos/${id}/reveal`);
    return response.data;
  },
  getChannelNotes: async (channel: string): Promise<string> => {
    const response = await api.get(`/competitor-analysis/channels/${encodeURIComponent(channel)}/notes`);
    return response.data.notes_md ?? '';
  },
  saveChannelNotes: async (channel: string, notes_md: string): Promise<void> => {
    await api.put(`/competitor-analysis/channels/${encodeURIComponent(channel)}/notes`, { notes_md });
  },
  startIngestion: async (handle: string, displayName: string, mcUsername: string): Promise<{ jobId: number; channel: string }> => {
    const response = await api.post('/competitor-analysis/channels', { handle, displayName, mcUsername });
    return response.data;
  },
  getIngestStatus: async (channel: string): Promise<any> => {
    const response = await api.get(`/competitor-analysis/channels/${encodeURIComponent(channel)}/ingest`);
    return response.data;
  },
};

