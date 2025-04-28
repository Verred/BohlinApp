import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { Chart, registerables } from 'chart.js';

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
      [key: string]: number;
    };
    feature_importances: {
      [key: string]: number;
    };
    training_date: string;
  };
  endpoints: {
    [key: string]: string;
  };
  status: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  loading = true;
  error = false;
  totalAccidentes = 0;
  ultimoRegistro: Date | null = null;
  
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
  
  constructor(private apiService: ApiService) {}
  
  ngOnInit(): void {
    this.loadData();
  }
  
  loadData(): void {
    this.loading = true;
    this.error = false;
    
    // Cargar datos de la base de datos
    this.apiService.getDatabaseData().subscribe({
      next: (response: any) => {
        const data = response.data as DatabaseData[];
        this.totalAccidentes = response.count || data.length;
        
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
    // Asegúrate de limpiar todos los canvas previos
    this.clearCharts();
    
    // Añadir un pequeño retraso para asegurar que el DOM está listo
    setTimeout(() => {
      // Histórico de accidentes por mes/año
      this.createHistoricoAccidentesChart(data);
      
      // Distribución por tipo de vía
      this.createTipoViaChart(data);
      
      // Distribución por distrito
      this.createDistritoChart(data);
      
      // Accidentes por día de la semana
      this.createAccidentesPorDiaChart(data);
      
      // Accidentes por hora
      this.createAccidentesPorHoraChart(data);
      
      // Si tenemos info del modelo, mostramos la importancia de variables
      if (modelInfo && modelInfo.model_metrics && modelInfo.model_metrics.feature_importances) {
        this.createImportanciaVariablesChart(modelInfo.model_metrics.feature_importances);
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
  
  createImportanciaVariablesChart(importancias: {[key: string]: number}): void {
    // Ordenar importancias de mayor a menor
    const importanciasOrdenadas = Object.entries(importancias)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {} as {[key: string]: number});
    
    const ctx = document.getElementById('importanciaVariablesChart') as HTMLCanvasElement;
    if (!ctx) return;
    
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(importanciasOrdenadas),
        datasets: [{
          label: 'Importancia',
          data: Object.values(importanciasOrdenadas),
          backgroundColor: '#9C27B0',
          borderColor: '#7B1FA2',
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Importancia Relativa'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Importancia de Variables en el Modelo Predictivo'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw as number;
                return `Importancia: ${(value * 100).toFixed(2)}%`;
              }
            }
          }
        }
      }
    });
  }
}
