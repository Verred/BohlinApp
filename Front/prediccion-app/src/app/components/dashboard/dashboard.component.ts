import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../services/api.service';
import { Chart, registerables } from 'chart.js';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Registrar los módulos necesarios de Chart.js
Chart.register(...registerables);

interface DatabaseData {
  id: number;
  FECHA_SINIESTRO: string;
  HORA_SINIESTRO: number;
  CLASE_SINIESTRO: number;
  CANTIDAD_DE_VEHICULOS_DANADOS: number;
  DISTRITO: number;
  ZONA: number;
  TIPO_DE_VIA: number;
  RED_VIAL: number;
  EXISTE_CICLOVIA: number;
  COORDENADAS_LATITUD: number;
  COORDENADAS_LONGITUD: number;
  CONDICION_CLIMATICA: number;
  ZONIFICACION: number;
  CARACTERISTICAS_DE_VIA: number;
  PERFIL_LONGITUDINAL_VIA: number;
  SUPERFICIE_DE_CALZADA: number;
  senalizacion: number;
  DIA_DE_LA_SEMANA: number;
  MES: number;
  PERIODO_DEL_DIA: number;
  Feriado: number;
  ACCIDENTE: number;
  created_at: string;
}

interface ModelInfo {
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

// Agregar esta interfaz después de las otras interfaces
interface DistritoRiesgo {
  nombre: string;
  accidentes: number;
  porcentaje: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatSnackBarModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  loading = true;
  error = false;
  totalAccidentes = 0;
  ultimoRegistro: Date | null = null;
  isGeneratingReport = false;
  isGeneratingDistrictReport = false; // Nueva propiedad para el reporte de distritos
  
  // Mapeo de códigos a nombres para una mejor visualización
  tipoViaNombres: { [key: number]: string } = {
    0: 'No especificado',
    1: 'Autopista',
    2: 'Avenida',
    3: 'Calle',
    4: 'Jirón',
    5: 'Carretera'
  };
  
  distritoNombres: { [key: number]: string } = {
    0: 'No especificado',
    1: 'Lima Centro',
    2: 'San Juan de Lurigancho',
    3: 'Miraflores',
    4: 'San Isidro',
    5: 'Surco',
    6: 'La Molina'
  };
  
  diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  
  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {}
  
  ngOnInit(): void {
    this.loadData();
  }
  
  loadData(): void {
    this.loading = true;
    this.error = false;
    
    // Cargar datos de la base de datos
    this.apiService.getDatabaseData().subscribe({
      next: (response: any) => {
        // Verificar si response es un array directamente o un objeto con data
        let data: DatabaseData[];
        let count: number;
        
        if (Array.isArray(response)) {
          // El backend devuelve directamente el array
          data = response as DatabaseData[];
          count = data.length;
        } else {
          // El backend devuelve un objeto con propiedades data y count
          data = response.data as DatabaseData[];
          count = response.count || data.length;
        }
        
        this.totalAccidentes = count;
        
        // Encontrar la fecha del último registro
        if (data.length > 0) {
          const fechas = data.map(item => new Date(item.FECHA_SINIESTRO));
          this.ultimoRegistro = new Date(Math.max(...fechas.map(date => date.getTime())));
        }
        
        // Cargar información del modelo para mostrar importancia de variables
        this.apiService.getModelInfo().subscribe({
          next: (modelInfo: ModelInfo) => {
            this.createCharts(data, modelInfo);
            this.loading = false;
          },
          error: (err) => {
            console.error('Error al cargar información del modelo:', err);
            // Si falla la carga del modelo, al menos mostramos los datos de accidentes
            this.createCharts(data);
            this.loading = false;
          }
        });
      },
      error: (err) => {
        console.error('Error al cargar datos:', err);
        this.loading = false;
        this.error = true;
      }
    });
  }
  
  createCharts(data: DatabaseData[], modelInfo?: ModelInfo): void {
    setTimeout(() => {
      // Histórico de accidentes
      this.createHistoricoAccidentesChart(data);
      
      // Accidentes por tipo de vía
      this.createTipoViaChart(data);
      
      // Accidentes por distrito
      this.createDistritoChart(data);
      
      // Accidentes por día
      this.createAccidentesPorDiaChart(data);
      
      // Accidentes por hora
      this.createAccidentesPorHoraChart(data);
      
      // Si tenemos info del modelo, mostramos la importancia de variables
      if (modelInfo && modelInfo.metrics && modelInfo.metrics.top_features) {
        this.createImportanciaVariablesChart(modelInfo.metrics.top_features);
      }
    }, 100);
  }
  
  clearCharts(): void {
    // Función para limpiar los canvas existentes y prevenir duplicados/problemas
    const chartIds = [
      'historicoAccidentesChart',
      'tipoViaChart',
      'distritoChart',
      'accidentesPorDiaChart',
      'accidentesPorHoraChart',
      'importanciaVariablesChart'
    ];
    
    chartIds.forEach(id => {
      const chartInstance = Chart.getChart(id);
      if (chartInstance) {
        chartInstance.destroy();
      }
    });
  }
  
  createHistoricoAccidentesChart(data: DatabaseData[]): void {
    // Agrupar datos por mes y año
    const accidentesPorMesAnio = data.reduce((acc, item) => {
      if (item.FECHA_SINIESTRO) {
        const fecha = new Date(item.FECHA_SINIESTRO);
        const mesAnio = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        acc[mesAnio] = (acc[mesAnio] || 0) + 1;
      }
      return acc;
    }, {} as {[key: string]: number});
    
    // Ordenar por fecha
    const mesAnioOrdenados = Object.keys(accidentesPorMesAnio).sort();
    
    // Etiquetar meses en formato más amigable
    const etiquetas = mesAnioOrdenados.map(mesAnio => {
      const [anio, mes] = mesAnio.split('-');
      const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${nombresMeses[parseInt(mes) - 1]} ${anio}`;
    });
    
    const valores = mesAnioOrdenados.map(mesAnio => accidentesPorMesAnio[mesAnio]);
    
    const ctx = document.getElementById('historicoAccidentesChart') as HTMLCanvasElement;
    if (!ctx) return;
    
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: etiquetas,
        datasets: [{
          label: 'Número de Accidentes',
          data: valores,
          fill: false,
          borderColor: '#4CAF50',
          tension: 0.1,
          backgroundColor: 'rgba(76, 175, 80, 0.2)'
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Número de Accidentes'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Mes / Año'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Evolución de Accidentes a lo largo del tiempo'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        }
      }
    });
  }
  
  createTipoViaChart(data: DatabaseData[]): void {
    // Agrupar por tipo de vía
    const tiposVia = data.reduce((acc, item) => {
      const tipoVia = this.tipoViaNombres[item.TIPO_DE_VIA] || `Tipo ${item.TIPO_DE_VIA}`;
      acc[tipoVia] = (acc[tipoVia] || 0) + 1;
      return acc;
    }, {} as {[key: string]: number});
    
    const ctx = document.getElementById('tipoViaChart') as HTMLCanvasElement;
    if (!ctx) return;
    
    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(tiposVia),
        datasets: [{
          label: 'Accidentes por Tipo de Vía',
          data: Object.values(tiposVia),
          backgroundColor: [
            '#4CAF50', '#2196F3', '#FFC107', '#E91E63', '#9C27B0',
            '#00BCD4', '#FF5722', '#795548', '#607D8B'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
          },
          title: {
            display: true,
            text: 'Distribución por Tipo de Vía'
          }
        }
      }
    });
  }
  
  createDistritoChart(data: DatabaseData[]): void {
    // Agrupar por distrito
    const distritos = data.reduce((acc, item) => {
      const distrito = this.distritoNombres[item.DISTRITO] || `Distrito ${item.DISTRITO}`;
      acc[distrito] = (acc[distrito] || 0) + 1;
      return acc;
    }, {} as {[key: string]: number});
    
    // Ordenar de mayor a menor para mejor visualización
    const distritosOrdenados = Object.entries(distritos)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {} as {[key: string]: number});
    
    const ctx = document.getElementById('distritoChart') as HTMLCanvasElement;
    if (!ctx) return;
    
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(distritosOrdenados),
        datasets: [{
          label: 'Número de Accidentes',
          data: Object.values(distritosOrdenados),
          backgroundColor: '#3498db',
          borderColor: '#2980b9',
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        scales: {
          x: {
            beginAtZero: true
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Accidentes por Distrito'
          }
        }
      }
    });
  }
  
  createAccidentesPorDiaChart(data: DatabaseData[]): void {
    // Inicializar array para cada día de la semana (0-6)
    const accidentesPorDia = Array(7).fill(0);
    
    data.forEach(item => {
      if (item.DIA_DE_LA_SEMANA >= 0 && item.DIA_DE_LA_SEMANA < 7) {
        accidentesPorDia[item.DIA_DE_LA_SEMANA]++;
      }
    });
    
    const ctx = document.getElementById('accidentesPorDiaChart') as HTMLCanvasElement;
    if (!ctx) return;
    
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.diasSemana,
        datasets: [{
          label: 'Número de Accidentes',
          data: accidentesPorDia,
          backgroundColor: '#27AE60',
          borderColor: '#1E8449',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Accidentes por Día de la Semana'
          }
        }
      }
    });
  }
  
  createAccidentesPorHoraChart(data: DatabaseData[]): void {
    // Inicializar array para cada hora (0-23)
    const accidentesPorHora = Array(24).fill(0);
    
    data.forEach(item => {
      if (item.HORA_SINIESTRO >= 0 && item.HORA_SINIESTRO < 24) {
        accidentesPorHora[item.HORA_SINIESTRO]++;
      }
    });
    
    const ctx = document.getElementById('accidentesPorHoraChart') as HTMLCanvasElement;
    if (!ctx) return;
    
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array.from({length: 24}, (_, i) => `${i}:00`),
        datasets: [{
          label: 'Número de Accidentes',
          data: accidentesPorHora,
          fill: true,
          backgroundColor: 'rgba(233, 30, 99, 0.2)',
          borderColor: '#E91E63',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Accidentes por Hora del Día'
          }
        }
      }
    });
  }
  
  createImportanciaVariablesChart(topFeatures: Array<{feature: string, importance: number}>): void {
    const ctx = document.getElementById('importanciaVariablesChart') as HTMLCanvasElement;
    if (!ctx) return;

    // Tomar solo las top 10 características más importantes
    const top10Features = topFeatures.slice(0, 10);
    
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top10Features.map(item => item.feature),
        datasets: [{
          label: 'Importancia',
          data: top10Features.map(item => item.importance),
          backgroundColor: 'rgba(156, 39, 176, 0.6)',
          borderColor: 'rgba(156, 39, 176, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Variables más importantes del modelo'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Importancia'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Variables'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        }
      }
    });
  }

  async generatePdfReport(): Promise<void> {
    // Verificar si hay errores o no hay datos
    if (this.error || this.totalAccidentes === 0) {
      this.snackBar.open('No hay datos disponibles para generar el reporte', 'Cerrar', {
        duration: 5000,
        panelClass: ['warning-snackbar']
      });
      return;
    }

    this.isGeneratingReport = true;
    
    try {
      // Mostrar mensaje de progreso inmediatamente
      const loadingSnackBar = this.snackBar.open('Preparando reporte PDF...', '', {
        duration: 0, // No auto-dismiss
        panelClass: ['info-snackbar']
      });

      // Esperar a que todos los gráficos estén completamente renderizados
      await this.waitForChartsToRender();

      loadingSnackBar.dismiss();
      const generatingSnackBar = this.snackBar.open('Generando reporte PDF...', '', {
        duration: 0,
        panelClass: ['info-snackbar']
      });

      // Crear el PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // Agregar encabezado
      this.addPdfHeader(pdf, pdfWidth);

      let yPosition = 50; // Posición inicial después del encabezado

      // Lista de gráficos a capturar
      const chartConfigs = [
        {
          id: 'historicoAccidentesChart',
          title: 'Evolución de Accidentes a lo largo del tiempo',
          height: 60
        },
        {
          id: 'tipoViaChart',
          title: 'Distribución por Tipo de Vía',
          height: 60
        },
        {
          id: 'distritoChart',
          title: 'Accidentes por Distrito',
          height: 60
        },
        {
          id: 'accidentesPorDiaChart',
          title: 'Accidentes por Día de la Semana',
          height: 60
        },
        {
          id: 'accidentesPorHoraChart',
          title: 'Accidentes por Hora del Día',
          height: 60
        },
        {
          id: 'importanciaVariablesChart',
          title: 'Variables más importantes del modelo',
          height: 60
        }
      ];

      generatingSnackBar.dismiss();
      const processingSnackBar = this.snackBar.open('Procesando gráficos...', '', {
        duration: 0,
        panelClass: ['info-snackbar']
      });

      // Procesar cada gráfico
      for (let i = 0; i < chartConfigs.length; i++) {
        const config = chartConfigs[i];
        
        // Actualizar mensaje de progreso
        processingSnackBar.dismiss();
        const currentProcessingSnackBar = this.snackBar.open(`Procesando gráfico ${i + 1} de ${chartConfigs.length}...`, '', {
          duration: 0,
          panelClass: ['info-snackbar']
        });

        const canvas = document.getElementById(config.id) as HTMLCanvasElement;
        
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          // Verificar si necesitamos una nueva página
          if (yPosition + config.height + 20 > pdfHeight - margin) {
            pdf.addPage();
            yPosition = margin + 10;
          }

          // Agregar título del gráfico
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text(config.title, margin, yPosition);
          yPosition += 8;

          // Capturar el canvas del gráfico
          const chartCanvas = await html2canvas(canvas, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            width: canvas.offsetWidth,
            height: canvas.offsetHeight
          });

          if (chartCanvas && chartCanvas.width > 0 && chartCanvas.height > 0) {
            const imgData = chartCanvas.toDataURL('image/png', 0.95);
            
            // Calcular dimensiones para el PDF
            const maxWidth = pdfWidth - (margin * 2);
            const maxHeight = config.height;
            
            const canvasAspectRatio = chartCanvas.width / chartCanvas.height;
            let imgWidth = maxWidth;
            let imgHeight = maxWidth / canvasAspectRatio;
            
            // Si la altura es mayor al máximo permitido, ajustar por altura
            if (imgHeight > maxHeight) {
              imgHeight = maxHeight;
              imgWidth = maxHeight * canvasAspectRatio;
            }

            // Centrar la imagen horizontalmente
            const xPosition = margin + (maxWidth - imgWidth) / 2;

            // Agregar imagen al PDF
            pdf.addImage(imgData, 'PNG', xPosition, yPosition, imgWidth, imgHeight);
            yPosition += imgHeight + 15; // Espacio después del gráfico
          }
        }

        currentProcessingSnackBar.dismiss();
      }

      // Agregar pie de página en la última página
      this.addPdfFooter(pdf, pdfWidth, pdfHeight);

      // Generar nombre del archivo con fecha y hora
      const now = new Date();
      const timestamp = now.toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      const fileName = `Dashboard_Accidentes_${timestamp}.pdf`;

      // Descargar el PDF
      pdf.save(fileName);

      this.snackBar.open(`✓ Reporte PDF generado exitosamente: ${fileName}`, 'Cerrar', {
        duration: 5000,
        panelClass: ['success-snackbar']
      });

    } catch (error) {
      console.error('Error al generar el reporte PDF:', error);
      
      let errorMessage = 'Error al generar el reporte PDF';
      if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      }
      
      this.snackBar.open(errorMessage, 'Cerrar', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
    } finally {
      this.isGeneratingReport = false;
      // Asegurar que cualquier snackbar de progreso se cierre
      this.snackBar.dismiss();
    }
  }

  /**
   * Espera a que todos los gráficos estén completamente renderizados
   */
  private async waitForChartsToRender(): Promise<void> {
    const chartIds = [
      'historicoAccidentesChart',
      'tipoViaChart', 
      'distritoChart',
      'accidentesPorDiaChart',
      'accidentesPorHoraChart',
      'importanciaVariablesChart'
    ];

    // Esperar a que todos los canvas existan y tengan contenido
    for (const chartId of chartIds) {
      await this.waitForChart(chartId);
    }

    // Esperar un tiempo adicional para asegurar renderizado completo
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Espera a que un gráfico específico esté renderizado
   */
  private async waitForChart(chartId: string): Promise<void> {
    return new Promise((resolve) => {
      const checkChart = () => {
        const canvas = document.getElementById(chartId) as HTMLCanvasElement;
        
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          // Verificar que el canvas tenga contenido visual
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const hasContent = imageData.data.some((pixel, index) => {
              // Verificar si hay píxeles no blancos (considerando RGBA)
              if (index % 4 === 3) return false; // Saltar canal alpha
              return pixel !== 255; // No es blanco puro
            });
            
            if (hasContent) {
              resolve();
              return;
            }
          }
        }
        
        // Si el gráfico no está listo, esperar y reintentar
        setTimeout(checkChart, 100);
      };
      
      checkChart();
    });
  }

  /**
   * Agrega encabezado al PDF
   */
  private addPdfHeader(pdf: jsPDF, pdfWidth: number): void {
    const currentDate = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const currentTime = new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Título principal
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(41, 128, 185); // Color azul
    pdf.text('DASHBOARD DE ACCIDENTES DE TRÁNSITO', pdfWidth / 2, 15, { align: 'center' });
    
    // Subtítulo
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Fecha: ${currentDate} - Hora: ${currentTime}`, pdfWidth / 2, 25, { align: 'center' });
    
    // Información de resumen
    pdf.setFontSize(11);
    pdf.text(`Total de accidentes registrados: ${this.totalAccidentes.toLocaleString()}`, pdfWidth / 2, 32, { align: 'center' });
    
    if (this.ultimoRegistro) {
      const ultimaFecha = this.ultimoRegistro.toLocaleDateString('es-ES');
      pdf.text(`Último registro: ${ultimaFecha}`, pdfWidth / 2, 38, { align: 'center' });
    }

    // Línea separadora
    pdf.setLineWidth(0.5);
    pdf.setDrawColor(200, 200, 200);
    pdf.line(15, 42, pdfWidth - 15, 42);
  }

  /**
   * Agrega pie de página al PDF
   */
  private addPdfFooter(pdf: jsPDF, pdfWidth: number, pdfHeight: number): void {
    const footerY = pdfHeight - 10;
    
    // Obtener el número total de páginas
    const pageCount = (pdf as any).internal.pages.length - 1; // -1 porque el primer elemento es metadata
    
    // Agregar pie de página a todas las páginas
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(128, 128, 128);
      
      // Texto del pie centrado
      const footerText = 'Generado automáticamente por el Sistema de Análisis de Accidentes';
      pdf.text(footerText, pdfWidth / 2, footerY - 3, { align: 'center' });
      
      // Número de página a la derecha
      if (pageCount > 1) {
        pdf.text(`Página ${i} de ${pageCount}`, pdfWidth - 15, footerY, { align: 'right' });
      }
    }
  }

  /**
   * Agrega imagen dividida en múltiples páginas
   */
  private async addMultiPageImage(
    pdf: jsPDF, 
    canvas: HTMLCanvasElement, 
    imgData: string, 
    margin: number, 
    startY: number, 
    imgWidth: number, 
    imgHeight: number,
    pdfHeight: number,
    availableHeight: number
  ): Promise<void> {
    let yPosition = startY;
    let remainingHeight = imgHeight;
    let sourceY = 0;
    let isFirstPage = true;

    while (remainingHeight > 0) {
      const pageHeight = isFirstPage ? availableHeight : pdfHeight - margin * 2;
      const heightToAdd = Math.min(remainingHeight, pageHeight);
      const sourceHeight = (heightToAdd * canvas.height) / imgHeight;

      // Crear canvas temporal para esta sección
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        throw new Error('No se pudo crear el contexto del canvas temporal');
      }
      
      tempCanvas.width = canvas.width;
      tempCanvas.height = sourceHeight;

      // Dibujar la sección correspondiente
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
      
      const tempImgData = tempCanvas.toDataURL('image/png', 0.95);
      
      // Agregar al PDF
      pdf.addImage(tempImgData, 'PNG', margin, yPosition, imgWidth, heightToAdd);

      remainingHeight -= heightToAdd;
      sourceY += sourceHeight;

      if (remainingHeight > 0) {
        pdf.addPage();
        yPosition = margin;
        isFirstPage = false;
      }
    }
  }

  async generateDistrictRiskReport(): Promise<void> {
    // Verificar si hay errores o no hay datos
    if (this.error || this.totalAccidentes === 0) {
      this.snackBar.open('Generación de reporte en blanco o error en los datos', 'Cerrar', {
        duration: 5000,
        panelClass: ['warning-snackbar']
      });
      return;
    }

    this.isGeneratingDistrictReport = true;
    
    try {
      // Cargar datos nuevamente para el análisis
      this.apiService.getDatabaseData().subscribe({
        next: async (response: any) => {
          let data: DatabaseData[];
          
          if (Array.isArray(response)) {
            data = response as DatabaseData[];
          } else {
            data = response.data as DatabaseData[];
          }

          // Mostrar mensaje de progreso
          this.snackBar.open('Generando reporte de zonas de alto riesgo...', '', {
            duration: 2000,
            panelClass: ['info-snackbar']
          });

          // Crear el contenido del reporte
          await this.createDistrictRiskPdf(data);
        },
        error: (err) => {
          console.error('Error al cargar datos para el reporte:', err);
          this.snackBar.open('Error al generar el reporte de zonas de riesgo', 'Cerrar', {
            duration: 3000,
            panelClass: ['error-snackbar']
          });
          this.isGeneratingDistrictReport = false;
        }
      });

    } catch (error) {
      console.error('Error al generar el reporte de zonas de riesgo:', error);
      this.snackBar.open('Error al generar el reporte de zonas de riesgo', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      this.isGeneratingDistrictReport = false;
    }
  }

  private async createDistrictRiskPdf(data: DatabaseData[]): Promise<void> {
    try {
      // Análisis de datos por distrito
      const districtAnalysis = this.analyzeDistrictRisk(data);
      
      // Crear el PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 20;

      // Título principal
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('REPORTE DE ZONAS DE ALTO RIESGO', pdfWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 10;
      pdf.setFontSize(14);
      pdf.text('Análisis por Distritos', pdfWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 15;
      
      // Información general
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      const currentDate = new Date().toLocaleDateString('es-ES');
      pdf.text(`Fecha de generación: ${currentDate}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Total de accidentes analizados: ${this.totalAccidentes}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Período analizado: ${districtAnalysis.periodoAnalisis}`, 20, yPosition);
      yPosition += 15;

      // Resumen ejecutivo
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RESUMEN EJECUTIVO', 20, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      const resumenTexto = [
        `• Distrito con mayor riesgo: ${districtAnalysis.distritoMayorRiesgo.nombre} (${districtAnalysis.distritoMayorRiesgo.accidentes} accidentes)`,
        `• Promedio de accidentes por distrito: ${districtAnalysis.promedioAccidentes.toFixed(1)}`,
        `• Distritos de alto riesgo: ${districtAnalysis.distritosAltoRiesgo.length}`,
        `• Concentración del riesgo: ${districtAnalysis.concentracionRiesgo}% en los top 3 distritos`
      ];

      resumenTexto.forEach(texto => {
        pdf.text(texto, 20, yPosition);
        yPosition += 6;
      });

      yPosition += 10;

      // Clasificación de distritos por nivel de riesgo
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('CLASIFICACIÓN POR NIVEL DE RIESGO', 20, yPosition);
      yPosition += 10;

      // Alto riesgo
      if (districtAnalysis.distritosAltoRiesgo.length > 0) {
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(220, 20, 60); // Color rojo
        pdf.text('ALTO RIESGO', 20, yPosition);
        yPosition += 8;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        
        districtAnalysis.distritosAltoRiesgo.forEach((distrito: DistritoRiesgo) => {
          const texto = `• ${distrito.nombre}: ${distrito.accidentes} accidentes (${distrito.porcentaje.toFixed(1)}% del total)`;
          pdf.text(texto, 25, yPosition);
          yPosition += 5;
        });
        yPosition += 5;
      }

      // SECCIÓN DE RIESGO MEDIO DESHABILITADA
      // Comentado para evitar que se corte en la página
      /*
      if (districtAnalysis.distritosRiesgoMedio.length > 0) {
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 140, 0); // Color naranja
        pdf.text('RIESGO MEDIO', 20, yPosition);
        yPosition += 8;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        
        districtAnalysis.distritosRiesgoMedio.forEach((distrito: DistritoRiesgo) => {
          const texto = `• ${distrito.nombre}: ${distrito.accidentes} accidentes (${distrito.porcentaje.toFixed(1)}% del total)`;
          pdf.text(texto, 25, yPosition);
          yPosition += 5;
        });
        yPosition += 5;
      }
      */

      // Bajo riesgo
      // if (districtAnalysis.distritosBajoRiesgo.length > 0) {
      //   pdf.setFontSize(12);
      //   pdf.setFont('helvetica', 'bold');
      //   pdf.setTextColor(34, 139, 34); // Color verde
      //   pdf.text('BAJO RIESGO', 20, yPosition);
      //   yPosition += 8;
        
      //   pdf.setFontSize(10);
      //   pdf.setFont('helvetica', 'normal');
      //   pdf.setTextColor(0, 0, 0);
        
      //   districtAnalysis.distritosBajoRiesgo.forEach((distrito: DistritoRiesgo) => {
      //     const texto = `• ${distrito.nombre}: ${distrito.accidentes} accidentes (${distrito.porcentaje.toFixed(1)}% del total)`;
      //     pdf.text(texto, 25, yPosition);
      //     yPosition += 5;
      //   });
      // }

      // Nueva página para recomendaciones
      pdf.addPage();
      yPosition = 30;

      // Recomendaciones
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('RECOMENDACIONES', 20, yPosition);
      yPosition += 10;

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      
      const recomendaciones = [
        'PARA DISTRITOS DE ALTO RIESGO:',
        '• Implementar campañas intensivas de seguridad vial',
        '• Incrementar la presencia policial en horarios pico',
        '• Mejorar la señalización y semáforos',
        '• Realizar auditorías de seguridad vial',
        '• Instalar cámaras de vigilancia en puntos críticos',
        '• Mejorar iluminación en intersecciones peligrosas',
        '',
        'MEDIDAS GENERALES:',
        '• Análisis detallado de patrones temporales por distrito',
        '• Coordinación entre distritos para mejores prácticas',
        '• Implementación de tecnología para monitoreo en tiempo real',
        '• Campañas de educación vial dirigidas a conductores',
        '• Evaluación periódica de la efectividad de las medidas'
      ];

      recomendaciones.forEach(rec => {
        if (rec === '') {
          yPosition += 5;
        } else if (rec.includes(':')) {
          pdf.setFont('helvetica', 'bold');
          pdf.text(rec, 20, yPosition);
          pdf.setFont('helvetica', 'normal');
          yPosition += 7;
        } else {
          pdf.text(rec, 20, yPosition);
          yPosition += 6;
        }
      });

      // Generar nombre del archivo
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `Reporte_Zonas_Alto_Riesgo_${timestamp}.pdf`;

      // Descargar el PDF
      pdf.save(fileName);

      this.snackBar.open(`Reporte de zonas de riesgo generado: ${fileName}`, 'Cerrar', {
        duration: 5000,
        panelClass: ['success-snackbar']
      });

    } catch (error) {
      console.error('Error al crear el PDF de zonas de riesgo:', error);
      throw error;
    } finally {
      this.isGeneratingDistrictReport = false;
    }
  }

  private analyzeDistrictRisk(data: DatabaseData[]): {
    distritosAltoRiesgo: DistritoRiesgo[];
    distritosRiesgoMedio: DistritoRiesgo[];
    distritosBajoRiesgo: DistritoRiesgo[];
    distritoMayorRiesgo: DistritoRiesgo;
    promedioAccidentes: number;
    concentracionRiesgo: number;
    periodoAnalisis: string;
  } {
    // Agrupar accidentes por distrito
    const accidentesPorDistrito = data.reduce((acc, item) => {
      const distrito = this.distritoNombres[item.DISTRITO] || `Distrito ${item.DISTRITO}`;
      acc[distrito] = (acc[distrito] || 0) + 1;
      return acc;
    }, {} as {[key: string]: number});

    // Convertir a array y ordenar
    const distritosArray: DistritoRiesgo[] = Object.entries(accidentesPorDistrito)
      .map(([nombre, accidentes]) => ({
        nombre,
        accidentes,
        porcentaje: (accidentes / this.totalAccidentes) * 100
      }))
      .sort((a, b) => b.accidentes - a.accidentes);

    // Calcular estadísticas
    const totalDistritos = distritosArray.length;
    const promedioAccidentes = this.totalAccidentes / totalDistritos;
    
    // Clasificación por riesgo
    const distritosAltoRiesgo = distritosArray.filter(d => d.accidentes > promedioAccidentes * 1.5);
    const distritosBajoRiesgo = distritosArray.filter(d => d.accidentes < promedioAccidentes * 0.5);
    const distritosRiesgoMedio = distritosArray.filter(d => 
      d.accidentes >= promedioAccidentes * 0.5 && d.accidentes <= promedioAccidentes * 1.5
    );

    // Concentración del riesgo en top 3
    const top3Accidentes = distritosArray.slice(0, 3).reduce((sum, d) => sum + d.accidentes, 0);
    const concentracionRiesgo = ((top3Accidentes / this.totalAccidentes) * 100);

    // Período de análisis
    const fechas = data.map(item => new Date(item.FECHA_SINIESTRO));
    const fechaMin = new Date(Math.min(...fechas.map(f => f.getTime())));
    const fechaMax = new Date(Math.max(...fechas.map(f => f.getTime())));
    const periodoAnalisis = `${fechaMin.toLocaleDateString('es-ES')} - ${fechaMax.toLocaleDateString('es-ES')}`;

    return {
      distritosAltoRiesgo,
      distritosRiesgoMedio,
      distritosBajoRiesgo,
      distritoMayorRiesgo: distritosArray[0],
      promedioAccidentes,
      concentracionRiesgo: parseFloat(concentracionRiesgo.toFixed(1)),
      periodoAnalisis
    };
  }

  // ...existing code...
}