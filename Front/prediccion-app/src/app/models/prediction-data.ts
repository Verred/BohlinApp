export interface PredictionData {
  // Campos de entrada para la predicción
  HORA_SINIESTRO?: number;
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
  
  // Campos de respuesta de la predicción (actualizados según la API)
  prediction?: number;
  probability?: number;
  is_accident?: boolean;
  status?: string;
  
  // Mantenemos los campos anteriores por compatibilidad
  resultado_prediccion?: string | number;
}

// Interfaz para el formato de envío al API
export interface PredictionRequest {
  values: number[];
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
  model_loaded: boolean;
  expected_columns: string[];
  num_features: number;
  model_metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    roc_auc: number;
    test_size: number;
    training_samples: number;
    test_samples: number;
    class_distribution: {
      '0': number;
      '1': number;
    };
    feature_importances: Record<string, number>;
    training_date: string;
  };
  endpoints: Record<string, string>;
  status: string;
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
