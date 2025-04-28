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
import { PredictionData } from '../../models/prediction-data';

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
  prediction: PredictionData | null = null;
  trainResponse: any = null; // Nueva propiedad para almacenar la respuesta del entrenamiento

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

  predict(): void {
    if (this.predictForm.invalid) {
      this.snackBar.open('Por favor completa todos los campos requeridos', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }

    this.isLoadingPredict = true;
    
    // Crear el array con los valores en el orden correcto
    const valuesArray = [
      this.predictForm.value.HORA_SINIESTRO,  // 'HORA SINIESTRO'
      this.predictForm.value.DISTRITO,        // 'DISTRITO'
      this.predictForm.value.ZONA,            // 'ZONA'
      this.predictForm.value.TIPO_DE_VIA,     // 'TIPO DE VÍA'
      this.predictForm.value.RED_VIAL,        // 'RED VIAL'
      this.predictForm.value.EXISTE_CICLOVIA, // 'EXISTE CICLOVÍA'
      this.predictForm.value.CONDICION_CLIMATICA, // 'CONDICIÓN CLIMÁTICA'
      this.predictForm.value.ZONIFICACION,    // 'ZONIFICACIÓN'
      this.predictForm.value.CARACTERISTICAS_DE_VIA, // 'CARACTERÍSTICAS DE VÍA'
      this.predictForm.value.PERFIL_LONGITUDINAL_VIA, // 'PERFIL LONGITUDINAL VÍA'
      this.predictForm.value.SUPERFICIE_DE_CALZADA, // 'SUPERFICIE DE CALZADA'
      this.predictForm.value.SENALIZACION,    // 'senalizacion'
      this.predictForm.value.DIA_DE_LA_SEMANA, // 'DIA_DE_LA_SEMANA'
      this.predictForm.value.MES,             // 'MES'
      this.predictForm.value.PERIODO_DEL_DIA, // 'PERIODO_DEL_DIA'
      this.predictForm.value.FERIADO          // 'Feriado'
    ];
    
    // Crear el objeto en formato { values: [...] }
    const requestData = { values: valuesArray };

    this.prediccionService.predict(requestData).subscribe({
      next: (result) => {
        console.log('Resultado recibido:', result);
        this.prediction = result;
        this.isLoadingPredict = false;
        
        // Mostrar snackbar con el resultado
        const message = result.is_accident ? 
          `¡Alerta! Alta probabilidad de accidente (${((result.probability ?? 0) * 100).toFixed(2)}%)` :
          `Baja probabilidad de accidente (${((result.probability ?? 0) * 100).toFixed(2)}%)`;
        
        this.snackBar.open(message, 'Cerrar', {
          duration: 5000,
          panelClass: [result.is_accident ? 'warning-snackbar' : 'success-snackbar']
        });
      },
      error: (err) => {
        console.log("Error en la petición:", requestData); // Log para verificar el objeto enviado
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
        // Generar un nombre de archivo que incluya la fecha
        const date = new Date().toISOString().split('T')[0];
        const filename = `predicciones_${date}.csv`;
        
        // Descargar el archivo
        //saveAs(blob, filename);
        
        this.isLoadingBatch = false;
        this.snackBar.open('Predicciones completadas y descargadas', 'Cerrar', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        
        // Limpiar el archivo seleccionado
        this.batchFile = null;
        this.fileName = '';
      },
      error: (err) => {
        console.error('Error al realizar predicciones por lotes:', err);
        this.isLoadingBatch = false;
        this.snackBar.open('Error al procesar el archivo', 'Cerrar', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
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
