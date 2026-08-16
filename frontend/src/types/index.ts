export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'biologist' | 'forest_staff' | 'reviewer';
  is_active: boolean;
}

export interface CameraStation {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  zone: 'core' | 'buffer' | 'corridor';
  range_beat: string;
  habitat: string;
  status: 'active' | 'maintenance' | 'inactive';
  is_village_adjacent: boolean;
  adjacent_village_name?: string;
  battery_level: number;
  active_trap_nights: number;
  operational_days: number;
  downtime_days: number;
  sightings_count: number;
  images_count: number;
}

export interface TigerSummary {
  id: string;
  tiger_code: string;
  callsign: string;
  sex: string;
  age_class: string;
  status: 'resident' | 'transient' | 'provisional' | 'dispersed';
  primary_zone: string;
  first_seen?: string;
  last_seen?: string;
  confidence: number;
  territory_area_km2: number;
  centroid?: { lat: number; lon: number };
  sightings_count: number;
  reference_thumbnail?: string;
  notes?: string;
}

export interface TigerDetail extends TigerSummary {
  gallery: {
    id: string;
    image_id: string;
    flank_side: string;
    quality_score: number;
    is_reference: boolean;
    crop_url: string;
    thumbnail_url: string;
    created_at: string;
  }[];
  sightings_timeline: {
    id: string;
    image_id: string;
    station_code: string;
    station_name: string;
    zone: string;
    latitude: number;
    longitude: number;
    captured_at: string;
    confidence: number;
    is_verified: boolean;
    thumbnail_url: string;
    notes?: string;
  }[];
  occupancy_polygon?: any;
}

export interface ReviewTask {
  id: string;
  task_type: 'tiger_id_ambiguity' | 'blank_quarantine' | 'metadata_correction' | 'provisional_tiger';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'resolved';
  created_at: string;
  image: {
    id: string;
    filename: string;
    captured_at: string;
    station_id?: string;
    station_code?: string;
    station_name?: string;
    zone?: string;
    thumbnail_url: string;
    image_url: string;
    flank_crop_url?: string;
    flank_side?: string;
  };
  candidates: {
    tiger_id: string;
    tiger_code: string;
    callsign: string;
    sex?: string;
    age_class?: string;
    primary_zone?: string;
    similarity: number;
    similarity_score?: number;
    reference_images?: {
      image_id: string;
      flank_side: string;
      crop_url: string;
      thumbnail_url: string;
    }[];
  }[];
}

export interface AlertExplanation {
  what_changed: string;
  why_it_matters: string;
  supporting_evidence: string;
  survey_effort: string;
  is_effort_artifact?: boolean;
  confidence: number;
  location: string;
}

export interface AlertItem {
  id: string;
  tiger_id?: string;
  tiger_code?: string;
  callsign?: string;
  station_code?: string;
  station_name?: string;
  zone?: string;
  alert_type: 'centroid_shift' | 'buffer_movement' | 'village_incursion' | 'prolonged_absence' | 'new_station';
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  status: 'active' | 'investigating' | 'acknowledged' | 'resolved' | 'dismissed';
  assigned_to?: string;
  resolution_notes?: string;
  created_at: string;
  explanation: AlertExplanation;
  thumbnail_url?: string;
}

export interface SyncStatus {
  is_online: boolean;
  sync_status: 'synced' | 'syncing' | 'offline' | 'error';
  device_id: string;
  last_synced_at?: string;
  pending_uploads: number;
  pending_downloads: number;
  failed_count: number;
}

export interface IngestionReport {
  batch_id: string;
  total_images: number;
  processed: number;
  duplicates: number;
  invalid: number;
  blank: number;
  non_blank: number;
  tiger_images: number;
  other_animals: number;
  human_images: number;
  quarantined: number;
  errors: number;
  processing_time_seconds: number;
  estimated_storage_saved_mb: number;
  status: string;
}

export interface TerritoryOverlap {
  tiger_a_id: string;
  tiger_a_code: string;
  tiger_a_callsign: string;
  tiger_b_id: string;
  tiger_b_code: string;
  tiger_b_callsign: string;
  overlap_km2: number;
  overlap_pct_a: number;
  overlap_pct_b: number;
}
