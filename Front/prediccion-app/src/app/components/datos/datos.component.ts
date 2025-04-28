import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatosService } from '../../services/datos.service';
import { PredictionData } from '../../models/prediction-data';

@Component({
  selector: 'app-datos',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './datos.component.html',
  styleUrl: './datos.component.scss'
})
export class DatosComponent implements OnInit {
  displayedColumns: string[] = [
    'id',
    'fecha',
    'hora',
    'clase',
    'vehiculos_danados',
    'distrito',
    'zona',
    'tipo_via',
    'red_vial',
    'ciclovia',
    'latitud',
    'longitud',
    'clima',
    'zonificacion',
    'caracteristicas_via',
    'perfil_via',
    'superficie_calzada',
    'senalizacion',
    'dia_semana',
    'mes',
    'periodo_dia',
    'feriado',
    'accidente',
    'created_at'
  ];
  
  dataSource: PredictionData[] = [];
  filteredData: PredictionData[] = [];
  isLoading = true;
  error = false;
  searchText = '';

  constructor(private datosService: DatosService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    this.error = false;

    this.datosService.getAllData().subscribe({
      next: (response) => {
        if (response.status === 'success' && response.data) {
          this.dataSource = response.data.map((item: any) => ({
            id: item.id,
            fecha: item.FECHA_SINIESTRO,
            hora: item.HORA_SINIESTRO,
            clase: item.CLASE_SINIESTRO,
            vehiculos_danados: item.CANTIDAD_DE_VEHICULOS_DANADOS,
            distrito: item.DISTRITO,
            zona: item.ZONA,
            tipo_via: item.TIPO_DE_VIA,
            red_vial: item.RED_VIAL,
            ciclovia: item.EXISTE_CICLOVIA,
            latitud: item.COORDENADAS_LATITUD,
            longitud: item.COORDENADAS_LONGITUD,
            clima: item.CONDICION_CLIMATICA,
            zonificacion: item.ZONIFICACION,
            caracteristicas_via: item.CARACTERISTICAS_DE_VIA,
            perfil_via: item.PERFIL_LONGITUDINAL_VIA,
            superficie_calzada: item.SUPERFICIE_DE_CALZADA,
            senalizacion: item.senalizacion,
            dia_semana: item.DIA_DE_LA_SEMANA,
            mes: item.MES,
            periodo_dia: item.PERIODO_DEL_DIA,
            feriado: item.Feriado,
            accidente: item.ACCIDENTE,
            created_at: item.created_at
          }));
          this.filteredData = [...this.dataSource];
        } else {
          this.error = true;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar datos:', err);
        this.isLoading = false;
        this.error = true;
      }
    });
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value.toLowerCase();
    this.searchText = filterValue;
    
    if (filterValue) {
      this.filteredData = this.dataSource.filter((item) => {
        return Object.keys(item).some(key => {
          // Convertir el valor a string para que podamos buscar en cualquier tipo de dato
          const value = String(item[key as keyof PredictionData] || '').toLowerCase();
          return value.includes(filterValue);
        });
      });
    } else {
      this.filteredData = [...this.dataSource];
    }
  }

  downloadCsv(): void {
    console.log('Descargando CSV...');
    this.datosService.downloadCsv();
  }
}
