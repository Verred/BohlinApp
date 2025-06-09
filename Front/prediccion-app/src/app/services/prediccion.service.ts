import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PredictionData, PredictionRequest, PredictionResponse } from '../models/prediction-data';

@Injectable({
  providedIn: 'root'
})
export class PrediccionService {
  private baseUrl = 'https://bohlin-api.onrender.com/api';

  constructor(private http: HttpClient) { }

  // Realizar predicción individual con el nuevo formato
  predict(data: PredictionRequest): Observable<PredictionResponse> {
    return this.http.post<PredictionResponse>(`${this.baseUrl}/predict/`, data);
  }

  // Realizar predicciones por lotes
  batchPredict(file: File, outputFormat: string = 'csv'): Observable<Blob> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('output_format', outputFormat);
    
    return this.http.post(`${this.baseUrl}/batch-predict/`, formData, {
      responseType: 'blob',
      observe: 'body'
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Obtener información para predicción por lotes
  getBatchPredictInfo(): Observable<any> {
    return this.http.get(`${this.baseUrl}/batch-predict/`);
  }

  private handleError(error: HttpErrorResponse) {
    console.error('Error en PrediccionService:', error);
    return throwError(() => error);
  }
}
