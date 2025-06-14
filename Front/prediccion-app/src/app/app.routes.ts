import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { DatosComponent } from './components/datos/datos.component';
import { PrediccionComponent } from './components/prediccion/prediccion.component';
import { OpcionesComponent } from './components/opciones/opciones.component';
import { LoginComponent } from './components/login/login.component';
import { ChangePasswordComponent } from './components/change-password/change-password.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'datos', component: DatosComponent, canActivate: [AuthGuard] },
  { path: 'prediccion', component: PrediccionComponent, canActivate: [AuthGuard] },
  { path: 'opciones', component: OpcionesComponent, canActivate: [AuthGuard] },
  { path: 'change-password', component: ChangePasswordComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '/login' }
];
