import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { DatosComponent } from './components/datos/datos.component';
import { PrediccionComponent } from './components/prediccion/prediccion.component';
import { OpcionesComponent } from './components/opciones/opciones.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'datos', component: DatosComponent },
  { path: 'prediccion', component: PrediccionComponent },
  { path: 'opciones', component: OpcionesComponent },
  { path: '**', redirectTo: '' }
];
