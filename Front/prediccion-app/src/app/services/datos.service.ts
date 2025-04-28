import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { saveAs } from 'file-saver';

@Injectable({
  providedIn: 'root'
})
export class DatosService {
  private baseUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  getAllData(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/database-data/`);
  }

  downloadCsv(): void {
    this.http.get(`${this.baseUrl}/download-csv/`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const date = new Date().toISOString().split('T')[0];
        const filename = `accidentes_data_${date}.csv`;
        saveAs(blob, filename);
      },
      error: (err) => {
        console.error('Error al descargar el archivo CSV:', err);
      }
    });
  }
}
