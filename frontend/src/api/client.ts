const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export class ApiClient {
  private static token: string | null = localStorage.getItem('pench_token');

  static setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('pench_token', token);
    } else {
      localStorage.removeItem('pench_token');
    }
  }

  static getToken(): string | null {
    return this.token || localStorage.getItem('pench_token');
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorDetail = 'API request failed';
      try {
        const errJson = await response.json();
        errorDetail = errJson.detail || errorDetail;
      } catch (_) {}
      throw new Error(errorDetail);
    }

    return response.json();
  }

  private static async requestText(endpoint: string): Promise<string> {
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, { headers });
    if (!response.ok) {
      throw new Error('Failed to fetch report data');
    }
    return response.text();
  }

  // Auth
  static async login(credentials: { email: string; password: string }) {
    return this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  static async firebaseLogin(id_token: string) {
    return this.request<any>('/auth/firebase-login', {
      method: 'POST',
      body: JSON.stringify({ id_token }),
    });
  }

  static async getMe() {
    return this.request<any>('/auth/me');
  }

  static async getUsers() {
    return this.request<any[]>('/auth/users');
  }

  static async createUser(payload: { email: string; full_name: string; password: string; role: string }) {
    return this.request<any>('/auth/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static async updateUserStatus(user_id: string, is_active: boolean) {
    return this.request<any>(`/auth/users/${user_id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active }),
    });
  }

  static async updateUserRole(user_id: string, role: string) {
    return this.request<any>(`/auth/users/${user_id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  static async getImageDetails(image_id: string) {
    return this.request<any>(`/images/${image_id}/details`);
  }

  // Triage & Ingestion
  static async getTriageStats() {
    return this.request<any>('/triage/statistics');
  }

  static async getBenchmark(iterations = 30) {
    return this.request<any>(`/triage/benchmark?iterations=${iterations}`);
  }

  static async getRecentDetections(limit = 6) {
    return this.request<any[]>(`/triage/recent-detections?limit=${limit}`);
  }

  static async scanFolder(folder_path: string) {
    return this.request<any>('/triage/scan-folder', {
      method: 'POST',
      body: JSON.stringify({ folder_path }),
    });
  }

  static async ingestFolder(folder_path: string, station_id?: string) {
    return this.request<any>('/triage/ingest-folder', {
      method: 'POST',
      body: JSON.stringify({ folder_path, station_id }),
    });
  }

  static async ingestFiles(files: File[], station_id?: string) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file, file.name);
    });
    if (station_id) {
      formData.append('station_id', station_id);
    }

    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/triage/ingest-files`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let errorDetail = 'File batch ingestion failed';
      try {
        const errJson = await response.json();
        errorDetail = errJson.detail || errorDetail;
      } catch (_) {}
      throw new Error(errorDetail);
    }

    return response.json();
  }

  static async ingestCsvData(csv_content: string, station_id?: string) {
    return this.request<any>('/triage/ingest-csv-data', {
      method: 'POST',
      body: JSON.stringify({ csv_content, station_id }),
    });
  }

  static async getQuarantined(limit = 50, offset = 0) {
    return this.request<any>(`/triage/quarantine?limit=${limit}&offset=${offset}`);
  }

  static async restoreQuarantine(image_id: string) {
    return this.request<any>(`/triage/quarantine/${image_id}/restore`, {
      method: 'POST',
    });
  }

  static async batchQuarantineAction(image_ids: string[], action: string, notes?: string) {
    return this.request<any>('/triage/quarantine/batch-action', {
      method: 'POST',
      body: JSON.stringify({ image_ids, action, notes }),
    });
  }

  // Tigers Catalogue
  static async getTigers(params?: { status?: string; zone?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.zone) query.append('zone', params.zone);
    if (params?.search) query.append('search', params.search);
    return this.request<any[]>(`/tigers?${query.toString()}`);
  }

  static async getTigerDetail(tiger_id: string) {
    return this.request<any>(`/tigers/${tiger_id}`);
  }

  static async updateTiger(tiger_id: string, payload: any) {
    return this.request<any>(`/tigers/${tiger_id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  // Reviews
  static async getReviewTasks(status = 'pending', task_type?: string) {
    const query = new URLSearchParams({ status });
    if (task_type) query.append('task_type', task_type);
    return this.request<any[]>(`/reviews/tasks?${query.toString()}`);
  }

  static async getReviewTaskDetail(task_id: string) {
    return this.request<any>(`/reviews/tasks/${task_id}`);
  }

  static async submitReviewDecision(decision: {
    task_id: string;
    action_taken: string;
    selected_tiger_id?: string;
    new_tiger_code?: string;
    new_callsign?: string;
    notes?: string;
  }) {
    return this.request<any>('/reviews/decisions', {
      method: 'POST',
      body: JSON.stringify(decision),
    });
  }

  // Camera Stations
  static async getStations(zone?: string) {
    const query = zone ? `?zone=${zone}` : '';
    return this.request<any[]>(`/stations${query}`);
  }

  static async getStationDetail(station_id: string) {
    return this.request<any>(`/stations/${station_id}`);
  }

  // Occupancy & GIS
  static async getOccupancySummary() {
    return this.request<any[]>('/occupancy/summary');
  }

  static async getOccupancyGeoJSON() {
    return this.request<any>('/occupancy/geojson');
  }

  static async getTerritoryOverlaps() {
    return this.request<any[]>('/occupancy/overlaps');
  }

  // Alerts
  static async getAlerts(params?: { status?: string; severity?: string; tiger_id?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.severity) query.append('severity', params.severity);
    if (params?.tiger_id) query.append('tiger_id', params.tiger_id);
    return this.request<any[]>(`/alerts?${query.toString()}`);
  }

  static async updateAlertStatus(alert_id: string, status: string, notes?: string) {
    return this.request<any>(`/alerts/${alert_id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, resolution_notes: notes }),
    });
  }

  static async scanAbsences() {
    return this.request<any>('/alerts/scan-absences', {
      method: 'POST',
    });
  }

  // Sync Engine
  static async getSyncStatus() {
    return this.request<any>('/sync/status');
  }

  static async toggleConnectivity(is_online: boolean) {
    return this.request<any>('/sync/toggle-connectivity', {
      method: 'POST',
      body: JSON.stringify({ is_online }),
    });
  }

  static async triggerSync() {
    return this.request<any>('/sync/trigger', {
      method: 'POST',
    });
  }

  static async getOutbox() {
    return this.request<any[]>('/sync/outbox');
  }

  static async getOutboxItems() {
    return this.request<any[]>('/sync/outbox');
  }

  static async getSyncLogs() {
    return this.request<any[]>('/sync/logs');
  }

  // Reports
  static async exportTigersCSV() {
    return this.requestText('/reports/tigers/csv');
  }

  static async exportAlertsCSV() {
    return this.requestText('/reports/alerts/csv');
  }

  static async exportEffortCSV() {
    return this.requestText('/reports/effort/csv');
  }

  // External
  static async getWeather() {
    return this.request<any>('/external/weather');
  }

  static async getGIS() {
    return this.request<any>('/external/gis');
  }

  // Configuration & Policies
  static async getPolicies() {
    return this.request<any>('/settings/policies');
  }

  static async updatePolicies(policies: any) {
    return this.request<any>('/settings/policies', {
      method: 'PUT',
      body: JSON.stringify(policies),
    });
  }
}
