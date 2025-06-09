import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { PrediccionService } from '../../services/prediccion.service';
import { ApiService } from '../../services/api.service';
import { PredictionData, PredictionRequest, PredictionResponse } from '../../models/prediction-data';
import { saveAs } from 'file-saver'; // Importar saveAs

@Component({
  selector: 'app-prediccion',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './prediccion.component.html',
  styleUrl: './prediccion.component.scss'
})
export class PrediccionComponent {
  predictForm: FormGroup;
  batchFile: File | null = null;
  fileName = '';
  isLoadingPredict = false;
  isLoadingBatch = false;
  isLoadingTrain = false;
  prediction: any = null; // Cambiar para manejar el nuevo formato de respuesta
  trainResponse: any = null;

  distritos = [
    { label: 'Distrito 1', value: 1 },
    { label: 'Distrito 2', value: 2 },
    { label: 'Distrito 3', value: 3 },
    // Agregar todos los distritos necesarios
  ];

  zonas = [
    { label: 'Urbana', value: 1 },
    { label: 'Rural', value: 2 },
    // Agregar todas las zonas necesarias
  ];

  tiposVia = [
    { label: 'Avenida', value: 1 },
    { label: 'Calle', value: 2 },
    { label: 'Autopista', value: 3 },
    // Agregar todos los tipos de vía necesarios
  ];

  redesViales = [
    { label: 'Principal', value: 1 },
    { label: 'Secundaria', value: 2 },
    // Agregar todas las redes viales necesarias
  ];

  condicionesClimaticas = [
    { label: 'Soleado', value: 0 },
    { label: 'Lluvioso', value: 1 },
    { label: 'Nublado', value: 2 },
    // Agregar todas las condiciones climáticas necesarias
  ];

  zonificaciones = [
    { label: 'Residencial', value: 1 },
    { label: 'Comercial', value: 2 },
    { label: 'Industrial', value: 3 },
    // Agregar todas las zonificaciones necesarias
  ];

  caracteristicasVia = [
    { label: 'Recta', value: 0 },
    { label: 'Curva', value: 1 },
    { label: 'Intersección', value: 2 },
    // Agregar todas las características necesarias
  ];

  perfilesLongitudinales = [
    { label: 'Plano', value: 0 },
    { label: 'Pendiente', value: 1 },
    // Agregar todos los perfiles necesarios
  ];

  superficiesCalzada = [
    { label: 'Asfalto', value: 1 },
    { label: 'Concreto', value: 2 },
    { label: 'Tierra', value: 3 },
    // Agregar todas las superficies necesarias
  ];

  senalizaciones = [
    { label: 'Adecuada', value: 0 },
    { label: 'Deficiente', value: 1 },
    // Agregar todas las señalizaciones necesarias
  ];

  diasSemana = [
    { label: 'Lunes', value: 1 },
    { label: 'Martes', value: 2 },
    { label: 'Miércoles', value: 3 },
    { label: 'Jueves', value: 4 },
    { label: 'Viernes', value: 5 },
    { label: 'Sábado', value: 6 },
    { label: 'Domingo', value: 7 }
  ];

  meses = [
    { label: 'Enero', value: 1 },
    { label: 'Febrero', value: 2 },
    { label: 'Marzo', value: 3 },
    { label: 'Abril', value: 4 },
    { label: 'Mayo', value: 5 },
    { label: 'Junio', value: 6 },
    { label: 'Julio', value: 7 },
    { label: 'Agosto', value: 8 },
    { label: 'Septiembre', value: 9 },
    { label: 'Octubre', value: 10 },
    { label: 'Noviembre', value: 11 },
    { label: 'Diciembre', value: 12 }
  ];

  periodosDia = [
    { label: 'Mañana', value: 1 },
    { label: 'Tarde', value: 2 },
    { label: 'Noche', value: 3 },
    // Agregar todos los períodos necesarios
  ];

  constructor(
    private fb: FormBuilder,
    private prediccionService: PrediccionService,
    private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {
    this.predictForm = this.fb.group({
      HORA_SINIESTRO: [14, [Validators.required, Validators.min(0), Validators.max(23)]],
      CLASE_SINIESTRO: [1, Validators.required], // Nuevo campo agregado
      DISTRITO: [2, Validators.required],
      ZONA: [1, Validators.required],
      TIPO_DE_VIA: [1, Validators.required],
      RED_VIAL: [1, Validators.required],
      EXISTE_CICLOVIA: [0, Validators.required],
      CONDICION_CLIMATICA: [0, Validators.required],
      ZONIFICACION: [1, Validators.required],
      CARACTERISTICAS_DE_VIA: [0, Validators.required],
      PERFIL_LONGITUDINAL_VIA: [0, Validators.required],
      SUPERFICIE_DE_CALZADA: [1, Validators.required],
      SENALIZACION: [0, Validators.required],
      DIA_DE_LA_SEMANA: [4, Validators.required],
      MES: [1, Validators.required],
      PERIODO_DEL_DIA: [1, Validators.required],
      FERIADO: [0, Validators.required]
    });
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
        this.batchFile = null;
        this.fileName = '';
        return;
      }
      
      this.batchFile = file;
      this.fileName = file.name;
    }
  }

  clearFile(): void {
    this.batchFile = null;
    this.fileName = '';
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  predict(): void {
    if (this.predictForm.invalid) {
      this.snackBar.open('Por favor completa todos los campos requeridos', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    this.isLoadingPredict = true;
    
    // Crear el objeto de datos en el nuevo formato
    const requestData: PredictionRequest = {
      data: [
        {
          HORA_SINIESTRO: this.predictForm.value.HORA_SINIESTRO,
          CLASE_SINIESTRO: this.predictForm.value.CLASE_SINIESTRO,
          CANTIDAD_DE_VEHICULOS_DANADOS: 2, // Valor fijo como solicitaste
          DISTRITO: this.predictForm.value.DISTRITO,
          ZONA: this.predictForm.value.ZONA,
          TIPO_DE_VIA: this.predictForm.value.TIPO_DE_VIA,
          RED_VIAL: this.predictForm.value.RED_VIAL,
          EXISTE_CICLOVIA: this.predictForm.value.EXISTE_CICLOVIA,
          CONDICION_CLIMATICA: this.predictForm.value.CONDICION_CLIMATICA,
          ZONIFICACION: this.predictForm.value.ZONIFICACION,
          CARACTERISTICAS_DE_VIA: this.predictForm.value.CARACTERISTICAS_DE_VIA,
          PERFIL_LONGITUDINAL_VIA: this.predictForm.value.PERFIL_LONGITUDINAL_VIA,
          SUPERFICIE_DE_CALZADA: this.predictForm.value.SUPERFICIE_DE_CALZADA,
          SENALIZACION: this.predictForm.value.SENALIZACION,
          DIA_DE_LA_SEMANA: this.predictForm.value.DIA_DE_LA_SEMANA,
          MES: this.predictForm.value.MES,
          PERIODO_DEL_DIA: this.predictForm.value.PERIODO_DEL_DIA,
          FERIADO: this.predictForm.value.FERIADO
        }
      ],
      threshold: 0.5 // Valor fijo como solicitaste
    };

    this.prediccionService.predict(requestData).subscribe({
      next: (result: PredictionResponse) => {
        console.log('Resultado recibido:', result);
        
        // Extraer la primera predicción ya que solo enviamos un elemento
        const firstPrediction = result.predictions[0];
        
        // Adaptar la respuesta al formato esperado por el template
        this.prediction = {
          prediction: firstPrediction.prediction,
          probability: firstPrediction.probability,
          is_accident: firstPrediction.accident_likely,
          risk_level: firstPrediction.risk_level,
          accident_likely: firstPrediction.accident_likely,
          status: result.success ? 'success' : 'error'
        };
        
        this.isLoadingPredict = false;
        
        // Mostrar snackbar con el resultado
        const message = firstPrediction.accident_likely ? 
          `¡Alerta! Alta probabilidad de accidente (${(firstPrediction.probability * 100).toFixed(2)}%) - Riesgo: ${firstPrediction.risk_level}` :
          `Baja probabilidad de accidente (${(firstPrediction.probability * 100).toFixed(2)}%) - Riesgo: ${firstPrediction.risk_level}`;
        
        this.snackBar.open(message, 'Cerrar', {
          duration: 5000,
          panelClass: [firstPrediction.accident_likely ? 'warning-snackbar' : 'success-snackbar']
        });
      },
      error: (err) => {
        console.log("Error en la petición:", requestData);
        console.error('Error al realizar predicción:', err);
        this.isLoadingPredict = false;
        this.snackBar.open('Error al realizar la predicción', 'Cerrar', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  batchPredict(): void {
    if (!this.batchFile) {
      this.snackBar.open('Por favor selecciona un archivo CSV', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    this.isLoadingBatch = true;
    this.prediccionService.batchPredict(this.batchFile).subscribe({
      next: (blob) => {
        // Generar un nombre de archivo que incluya la fecha y hora
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `predicciones_lotes_${date}_${time}.csv`;
        
        // Descargar el archivo
        saveAs(blob, filename);
        
        this.isLoadingBatch = false;
        this.snackBar.open(`Predicciones completadas y descargadas como: ${filename}`, 'Cerrar', {
          duration: 5000,
          panelClass: ['success-snackbar']
        });
        
        // Limpiar el archivo seleccionado
        this.batchFile = null;
        this.fileName = '';
        
        // Opcional: resetear el input file
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      },
      error: (err) => {
        console.error('Error al realizar predicciones por lotes:', err);
        this.isLoadingBatch = false;
        
        // Mejorar el manejo de errores
        let errorMessage = 'Error al procesar el archivo';
        if (err.error instanceof Blob) {
          // Si el error viene como blob, intentar leerlo
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const errorData = JSON.parse(reader.result as string);
              errorMessage = errorData.message || errorMessage;
            } catch {
              errorMessage = 'Error en el formato del archivo o en el servidor';
            }
            this.snackBar.open(errorMessage, 'Cerrar', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          };
          reader.readAsText(err.error);
        } else if (err.error?.message) {
          errorMessage = err.error.message;
          this.snackBar.open(errorMessage, 'Cerrar', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        } else {
          this.snackBar.open(errorMessage, 'Cerrar', {
            duration: 3000,
            panelClass: ['error-snackbar']
          });
        }
      }
    });
  }

  trainModel(): void {
    this.isLoadingTrain = true;

    this.apiService.trainModel().subscribe({
      next: (result) => {
        this.isLoadingTrain = false;

        // Mostrar los resultados en un snackbar
        const message = `
          Status: ${result.status}
          Mensaje: ${result.message}
          Accuracy: ${result.details?.metrics?.accuracy?.toFixed(4) || 'N/A'}
          Precision: ${result.details?.metrics?.precision?.toFixed(4) || 'N/A'}
          Recall: ${result.details?.metrics?.recall?.toFixed(4) || 'N/A'}
          F1 Score: ${result.details?.metrics?.f1_score?.toFixed(4) || 'N/A'}
        `;
        this.snackBar.open(message, 'Cerrar', {
          duration: 10000, // Mostrar por 10 segundos
          panelClass: ['success-snackbar'],
          verticalPosition: 'top', // Opcional: posición en la pantalla
        });
      },
      error: (err) => {
        console.error('Error al entrenar el modelo:', err);
        this.isLoadingTrain = false;
        this.snackBar.open('Error al entrenar el modelo', 'Cerrar', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  resetForm(): void {
    this.predictForm.reset({
      HORA_SINIESTRO: 14,
      CLASE_SINIESTRO: 1, // Nuevo campo agregado
      DISTRITO: 2,
      ZONA: 1,
      TIPO_DE_VIA: 1,
      RED_VIAL: 1,
      EXISTE_CICLOVIA: 0,
      CONDICION_CLIMATICA: 0,
      ZONIFICACION: 1,
      CARACTERISTICAS_DE_VIA: 0, 
      PERFIL_LONGITUDINAL_VIA: 0,
      SUPERFICIE_DE_CALZADA: 1,
      SENALIZACION: 0,
      DIA_DE_LA_SEMANA: 4,
      MES: 1,
      PERIODO_DEL_DIA: 1,
      FERIADO: 0
    });
    this.prediction = null;
  }
}
