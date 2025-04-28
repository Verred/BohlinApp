import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PredictionData } from '../models/prediction-data';

@Injectable({
  providedIn: 'root'
})
export class PrediccionService {
  private baseUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) { }

  // Realizar predicción individual
  predict(data: { values: number[] }): Observable<PredictionData> {
    return this.http.post<PredictionData>(`${this.baseUrl}/predict/`, data);
  }

  // Realizar predicciones por lotes
  batchPredict(file: File): Observable<Blob> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.baseUrl}/batch-predict/`, formData, {
      responseType: 'blob'
    });
  }

  // Obtener información para predicción por lotes
  getBatchPredictInfo(): Observable<any> {
    return this.http.get(`${this.baseUrl}/batch-predict/`);
  }
}
