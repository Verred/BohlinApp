import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../services/api.service';
import { ApiModelResponse, ModelInfo } from '../../models/prediction-data';

@Component({
  selector: 'app-opciones',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule
  ],
  templateUrl: './opciones.component.html',
  styleUrl: './opciones.component.scss'
})
export class OpcionesComponent implements OnInit {
  modelInfo: ModelInfo | null = null;
  isLoading = true;
  error = false;
  isUploadingFile = false;
  selectedFile: File | null = null;
  fileName = '';
  displayedColumns: string[] = ['endpoint', 'method', 'description'];
  endpoints: any[] = [];

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadModelInfo();
  }

  loadModelInfo(): void {
    this.isLoading = true;
    this.error = false;

    this.apiService.getModelInfo().subscribe({
      next: (response: ApiModelResponse) => {
        // Map the API response to our ModelInfo type
        this.modelInfo = {
          model_name: 'Modelo de Predicción de Siniestros',
          version: '1.0',
          training_date: new Date(response.model_metrics.training_date),
          data_records: response.model_metrics.training_samples + response.model_metrics.test_samples,
          accuracy: response.model_metrics.accuracy,
          precision: response.model_metrics.precision,
          recall: response.model_metrics.recall,
          f1_score: response.model_metrics.f1_score,
          status: response.model_loaded ? 'Activo' : 'Inactivo'
        };
        
        // Preparar los endpoints para mostrar en la tabla
        this.prepareEndpoints();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar información del modelo:', err);
        this.isLoading = false;
        this.error = true;
      }
    });
  }

  prepareEndpoints(): void {
    // Esta información la estamos hardcodeando ya que normalmente vendría de la API
    this.endpoints = [
      {
        endpoint: '/api/predict/',
        methods: 'GET, POST',
        description: 'Permite hacer una predicción individual'
      },
      {
        endpoint: '/api/batch-predict/',
        methods: 'GET, POST',
        description: 'Permite hacer predicciones por lotes subiendo un archivo CSV'
      },
      {
        endpoint: '/api/model-info/',
        methods: 'GET',
        description: 'Devuelve información sobre el modelo actual y los endpoints disponibles'
      },
      {
        endpoint: '/api/train-model/',
        methods: 'GET, POST',
        description: 'Permite entrenar o reentrenar el modelo usando datos de la base de datos'
      },
      {
        endpoint: '/api/database-data/',
        methods: 'GET, DELETE',
        description: 'Devuelve los datos de la base en formato JSON o elimina todos los datos'
      },
      {
        endpoint: '/api/download-csv/',
        methods: 'GET',
        description: 'Permite descargar todos los datos de la base en formato CSV'
      },
      {
        endpoint: '/upload-and-train/',
        methods: 'GET, POST',
        description: 'Permite subir un archivo CSV, importar sus datos a la base y entrenar el modelo'
      }
    ];
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validar que sea un archivo CSV
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        this.snackBar.open('Por favor selecciona un archivo CSV válido', 'Cerrar', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        this.selectedFile = null;
        this.fileName = '';
        return;
      }
      
      this.selectedFile = file;
      this.fileName = file.name;
    }
  }

  uploadAndTrain(): void {
    if (!this.selectedFile) {
      this.snackBar.open('Por favor selecciona un archivo CSV', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    this.isUploadingFile = true;
    this.apiService.uploadAndTrain(this.selectedFile).subscribe({
      next: (result) => {
        this.isUploadingFile = false;
        this.snackBar.open('Archivo subido y modelo entrenado correctamente', 'Cerrar', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        
        // Recargar información del modelo
        this.loadModelInfo();
        
        // Limpiar el archivo seleccionado
        this.selectedFile = null;
        this.fileName = '';
      },
      error: (err) => {
        console.error('Error al subir archivo y entrenar modelo:', err);
        this.isUploadingFile = false;
        this.snackBar.open('Error al procesar el archivo', 'Cerrar', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  deleteData(): void {
    if (confirm('¿Estás seguro de que deseas eliminar todos los datos? Esta acción no se puede deshacer.')) {
      this.apiService.deleteAllData().subscribe({
        next: (result) => {
          this.snackBar.open('Todos los datos han sido eliminados', 'Cerrar', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          
          // Recargar información del modelo
          this.loadModelInfo();
        },
        error: (err) => {
          console.error('Error al eliminar datos:', err);
          this.snackBar.open('Error al eliminar los datos', 'Cerrar', {
            duration: 3000,
            panelClass: ['error-snackbar']
          });
        }
      });
    }
  }
}
