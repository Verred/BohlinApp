import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ModelInfo } from '../models/model-info';
import { PredictionData } from '../models/prediction-data';
import { ApiModelResponse } from '../models/prediction-data';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseEndpoint = 'http://localhost:8000/api';

  constructor(private http: HttpClient) { }

  // Obtener información del modelo
  getModelInfo(): Observable<ApiModelResponse> {
    return this.http.get<ApiModelResponse>(`${this.baseEndpoint}/model-info/`);
  }

  // Obtener datos de la base de datos
  getDatabaseData(): Observable<PredictionData[]> {
    console.log('Obtuvo dato');
    return this.http.get<PredictionData[]>(`${this.baseEndpoint}/siniestros/accidentes/`);
  }

  // Eliminar todos los datos
  deleteAllData(): Observable<any> {
    return this.http.delete(`${this.baseEndpoint}/siniestros/delete_all/`);
  }

  // Descargar datos en CSV
  downloadCsv(): Observable<Blob> {
    return this.http.get(`${this.baseEndpoint}/download-csv/`, {
      responseType: 'blob'
    });
  }

  // Entrenar modelo
  trainModel(): Observable<any> {
    return this.http.post(`${this.baseEndpoint}/train-model/`, {});
  }

  // Subir CSV y entrenar
  uploadAndTrain(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('auto_retrain', 'true'); 
    return this.http.post(`${this.baseEndpoint}/upload-and-train/`, formData);
  }
}
