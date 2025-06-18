import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  hidePassword = true;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      
      const { username, password } = this.loginForm.value;
      console.log('Intentando login con:', username);
      
      this.authService.login(username, password).subscribe({
        next: (response) => {
          console.log('Login exitoso:', response);
          this.isLoading = false;
          
          // Verificar que el servicio reconoce que está logueado
          setTimeout(() => {
            console.log('¿Está logueado después del login?', this.authService.isLoggedIn());
            
            this.snackBar.open('Inicio de sesión exitoso', 'Cerrar', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
            
            console.log('Navegando a dashboard...');
            this.router.navigate(['/dashboard']).then(success => {
              console.log('Navegación exitosa:', success);
              if (!success) {
                console.log('La navegación falló - probablemente bloqueada por AuthGuard');
              }
            }).catch(error => {
              console.error('Error en navegación:', error);
            });
          }, 100); // Pequeño delay para asegurar que el token se guardó
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Error en login:', error);
          
          let errorMessage = 'Error de conexión. Intente nuevamente.';
          
          // Manejo específico para errores de validación
          if (error.status === 400) {
            if (error.error?.message) {
              errorMessage = error.error.message;
            }
            // Si hay errores específicos de campos
            if (error.error?.errors?.non_field_errors) {
              errorMessage = error.error.errors.non_field_errors[0] || 'Credenciales incorrectas';
            }
            // Mensaje genérico para error 400
            if (errorMessage === 'Datos inválidos') {
              errorMessage = 'Credenciales inválidas';
            }
          } else if (error.status === 401) {
            errorMessage = 'Credenciales incorrectas';
          } else if (error.error?.detail) {
            errorMessage = error.error.detail;
          }
          
          this.snackBar.open(`⚠️ ${errorMessage}`, '✖', {
            duration: 5000,
            panelClass: ['error-snackbar'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      });
    }
  }
}