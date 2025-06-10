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
      this.snackBar.open('Generación de reporte en blanco o error en los datos', 'Cerrar', {
        duration: 5000,
        panelClass: ['warning-snackbar']
      });
      return;
    }

    this.isGeneratingReport = true;
    
    try {
      // Obtener el contenedor del dashboard
      const dashboardElement = document.querySelector('.dashboard-content') as HTMLElement;
      
      if (!dashboardElement) {
        throw new Error('No se encontró el contenido del dashboard');
      }

      // Mostrar mensaje de progreso
      this.snackBar.open('Generando reporte PDF...', '', {
        duration: 2000,
        panelClass: ['info-snackbar']
      });

      // Configurar html2canvas para mejor calidad
      const canvas = await html2canvas(dashboardElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: dashboardElement.scrollWidth,
        height: dashboardElement.scrollHeight
      });

      // Crear el PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Calcular dimensiones para ajustar la imagen al PDF
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20; // Margen de 10mm a cada lado
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Agregar título
      const currentDate = new Date().toLocaleDateString('es-ES');
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Dashboard de Accidentes de Tránsito', pdfWidth / 2, 15, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Fecha de generación: ${currentDate}`, pdfWidth / 2, 25, { align: 'center' });
      pdf.text(`Total de accidentes: ${this.totalAccidentes}`, pdfWidth / 2, 32, { align: 'center' });

      // Si la imagen es muy alta, dividirla en páginas
      let yPosition = 40;
      let remainingHeight = imgHeight;
      let sourceY = 0;

      while (remainingHeight > 0) {
        const pageHeight = pdfHeight - yPosition - 10; // Margen inferior
        const heightToAdd = Math.min(remainingHeight, pageHeight);
        const sourceHeight = (heightToAdd * canvas.height) / imgHeight;

        // Crear un canvas temporal para esta parte de la imagen
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = sourceHeight;

        if (tempCtx) {
          tempCtx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
          const tempImgData = tempCanvas.toDataURL('image/png');
          
          pdf.addImage(tempImgData, 'PNG', 10, yPosition, imgWidth, heightToAdd);
        }

        remainingHeight -= heightToAdd;
        sourceY += sourceHeight;

        if (remainingHeight > 0) {
          pdf.addPage();
          yPosition = 10;
        }
      }

      // Generar nombre del archivo con fecha y hora
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `Dashboard_Accidentes_${timestamp}.pdf`;

      // Descargar el PDF
      pdf.save(fileName);

      this.snackBar.open(`Reporte PDF generado exitosamente: ${fileName}`, 'Cerrar', {
        duration: 5000,
        panelClass: ['success-snackbar']
      });

    } catch (error) {
      console.error('Error al generar el reporte PDF:', error);
      this.snackBar.open('Error al generar el reporte PDF', 'Cerrar', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    } finally {
      this.isGeneratingReport = false;
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

      // Riesgo medio
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

      // Bajo riesgo
      if (districtAnalysis.distritosBajoRiesgo.length > 0) {
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(34, 139, 34); // Color verde
        pdf.text('BAJO RIESGO', 20, yPosition);
        yPosition += 8;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        
        districtAnalysis.distritosBajoRiesgo.forEach((distrito: DistritoRiesgo) => {
          const texto = `• ${distrito.nombre}: ${distrito.accidentes} accidentes (${distrito.porcentaje.toFixed(1)}% del total)`;
          pdf.text(texto, 25, yPosition);
          yPosition += 5;
        });
      }

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
        '',
        'PARA DISTRITOS DE RIESGO MEDIO:',
        '• Monitoreo continuo de puntos críticos',
        '• Campañas de concientización dirigidas',
        '• Mejoras puntuales en infraestructura',
        '',
        'MEDIDAS GENERALES:',
        '• Análisis detallado de patrones temporales',
        '• Coordinación entre distritos para mejores prácticas',
        '• Implementación de tecnología para monitoreo'
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
