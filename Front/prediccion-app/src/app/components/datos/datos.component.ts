import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource } from '@angular/material/table';
import { DatosService } from '../../services/datos.service';
import { AccidentData } from '../../models/prediction-data';

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
export class DatosComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = [
    'id',
    'FECHA_SINIESTRO',
    'HORA_SINIESTRO',
    'CLASE_SINIESTRO',
    'CANTIDAD_DE_VEHICULOS_DANADOS',
    'DISTRITO',
    'ZONA',
    'TIPO_DE_VIA',
    'RED_VIAL',
    'EXISTE_CICLOVIA',
    'CONDICION_CLIMATICA',
    'ZONIFICACION',
    'CARACTERISTICAS_DE_VIA',
    'PERFIL_LONGITUDINAL_VIA',
    'SUPERFICIE_DE_CALZADA',
    'SENALIZACION',
    'DIA_DE_LA_SEMANA',
    'MES',
    'PERIODO_DEL_DIA',
    'FERIADO',
    'ACCIDENTE',
    'FECHA_INGRESO'
  ];
  
  dataSource = new MatTableDataSource<any>([]);
  isLoading = true;
  error = false;
  searchText = '';

  constructor(private datosService: DatosService) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    // Asignar el paginador y sort después de que la vista se inicialice
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    
    // Configurar opciones de página
    if (this.paginator) {
      this.paginator.pageSize = 5;
      this.paginator.pageSizeOptions = [5, 10, 30, 50];
    }
  }

  loadData(): void {
    this.isLoading = true;
    this.error = false;

    this.datosService.getAllData().subscribe({
      next: (response) => {
        console.log('Datos recibidos:', response);
        if (Array.isArray(response) && response.length > 0) {
          // Usar los datos directamente sin mapeo
          this.dataSource.data = response;
          
          // Re-asignar el paginador después de cargar los datos
          setTimeout(() => {
            if (this.paginator) {
              this.dataSource.paginator = this.paginator;
            }
            if (this.sort) {
              this.dataSource.sort = this.sort;
            }
          });
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
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
    
    // Resetear a la primera página cuando se aplique un filtro
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  downloadCsv(): void {
    console.log('Descargando CSV...');
    this.datosService.downloadCsv();
  }
}
