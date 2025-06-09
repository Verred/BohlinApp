export interface PredictionData {
  // Campos de entrada para la predicción
  HORA_SINIESTRO?: number;
  CLASE_SINIESTRO?: number;
  CANTIDAD_DE_VEHICULOS_DANADOS?: number;
  DISTRITO?: number;
  ZONA?: number;
  TIPO_DE_VIA?: number;
  RED_VIAL?: number;
  EXISTE_CICLOVIA?: number;
  CONDICION_CLIMATICA?: number;
  ZONIFICACION?: number;
  CARACTERISTICAS_DE_VIA?: number;
  PERFIL_LONGITUDINAL_VIA?: number;
  SUPERFICIE_DE_CALZADA?: number;
  SENALIZACION?: number;
  DIA_DE_LA_SEMANA?: number;
  MES?: number;
  PERIODO_DEL_DIA?: number;
  FERIADO?: number;
  
  // Campos de respuesta de la predicción (actualizados según la nueva API)
  prediction?: number;
  probability?: number;
  is_accident?: boolean;
  risk_level?: string;
  accident_likely?: boolean;
  status?: string;
  
  // Mantenemos los campos anteriores por compatibilidad
  resultado_prediccion?: string | number;
}

// Nueva interfaz para el formato de envío a la API actualizada
export interface PredictionRequest {
  data: Array<{
    HORA_SINIESTRO: number;
    CLASE_SINIESTRO: number;
    CANTIDAD_DE_VEHICULOS_DANADOS: number;
    DISTRITO: number;
    ZONA: number;
    TIPO_DE_VIA: number;
    RED_VIAL: number;
    EXISTE_CICLOVIA: number;
    CONDICION_CLIMATICA: number;
    ZONIFICACION: number;
    CARACTERISTICAS_DE_VIA: number;
    PERFIL_LONGITUDINAL_VIA: number;
    SUPERFICIE_DE_CALZADA: number;
    SENALIZACION: number;
    DIA_DE_LA_SEMANA: number;
    MES: number;
    PERIODO_DEL_DIA: number;
    FERIADO: number;
  }>;
  threshold: number;
}

// Nueva interfaz para la respuesta de la API
export interface PredictionResponse {
  success: boolean;
  predictions: Array<{
    index: number;
    input_data: any;
    prediction: number;
    probability: number;
    risk_level: string;
    accident_likely: boolean;
  }>;
  summary: {
    total_predictions: number;
    accidents_predicted: number;
    high_risk: number;
    medium_risk: number;
    low_risk: number;
  };
  threshold_used: number;
  storage_type: string;
}

// Interfaz para la respuesta de entrenamiento del modelo
export interface ModelTrainingResponse {
  status: string;
  message: string;
  details?: {
    metrics?: {
      accuracy: number;
      precision: number;
      recall: number;
      f1_score: number;
      roc_auc?: number;
      training_samples?: number;
      test_samples?: number;
      training_date?: string;
    };
    model_info?: {
      name: string;
      version: string;
      date_created: string;
    };
  };
}

export interface ApiModelResponse {
  success: boolean;
  model_info: {
    model_exists: boolean;
    model_size_bytes: number;
    model_size_mb: number;
    last_modified: string | null;
    storage_path: string;
    storage_type: string;
    training_fields: string[];
    target_field: string;
    excluded_fields: string[];
  };
  metrics: {
    timestamp: string;
    training_date: string;
    threshold: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    roc_auc: number;
    confusion_matrix: {
      true_negatives: number;
      false_positives: number;
      false_negatives: number;
      true_positives: number;
    };
    dataset_info: {
      total_samples: number;
      training_samples: number;
      test_samples: number;
      features_count: number;
      target_distribution: {
        '0': number;
        '1': number;
      };
    };
    top_features: Array<{
      feature: string;
      importance: number;
    }>;
  };
}

export interface ModelInfo {
  model_name: string;
  version: string;
  training_date: Date;
  data_records: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  status: string;
}

export interface AccidentData {
  id: number;
  fecha: string;
  hora: number;
  clase: number;
  vehiculos_danados: number;
  distrito: number;
  zona: number;
  tipo_via: number;
  red_vial: number;
  ciclovia: number;
  clima: number;
  zonificacion: number;
  caracteristicas_via: number;
  perfil_via: number;
  superficie_calzada: number;
  senalizacion: number;
  dia_semana: number;
  mes: number;
  periodo_dia: number;
  feriado: number;
  accidente: number;
  created_at: string;
}
