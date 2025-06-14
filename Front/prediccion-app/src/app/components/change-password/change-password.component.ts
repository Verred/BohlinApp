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
  selector: 'app-change-password',
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
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.scss']
})
export class ChangePasswordComponent {
  passwordForm: FormGroup;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {
    this.passwordForm = this.fb.group({
      old_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('new_password');
    const confirmPassword = form.get('confirm_password');
    
    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  onSubmit(): void {
    if (this.passwordForm.valid) {
      this.isLoading = true;
      
      const { old_password, new_password, confirm_password } = this.passwordForm.value;
      
      // Debug: mostrar los valores del formulario
      console.log('Valores del formulario:', {
        old_password: old_password ? '[PRESENTE]' : '[VACIO]',
        new_password: new_password ? '[PRESENTE]' : '[VACIO]',
        confirm_password: confirm_password ? '[PRESENTE]' : '[VACIO]'
      });
      
      this.authService.changePassword(old_password, new_password, confirm_password).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.snackBar.open('Contraseña cambiada exitosamente', 'Cerrar', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Error al cambiar contraseña:', error);
          
          // Debug: mostrar los errores específicos de la API
          console.log('Errores específicos de la API:', error.error?.errors);
          
          let errorMessage = 'Error al cambiar la contraseña';
          if (error.error?.errors) {
            // Mostrar errores específicos de validación
            const errors = error.error.errors;
            if (errors.old_password) {
              errorMessage = `Contraseña actual: ${errors.old_password[0]}`;
            } else if (errors.new_password) {
              errorMessage = `Nueva contraseña: ${errors.new_password[0]}`;
            } else if (errors.confirm_password) {
              errorMessage = `Confirmar contraseña: ${errors.confirm_password[0]}`;
            }
          } else if (error.error?.detail) {
            errorMessage = error.error.detail;
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          }
          
          this.snackBar.open(errorMessage, 'Cerrar', {
            duration: 3000,
            panelClass: ['error-snackbar']
          });
        }
      });
    } else {
      console.log('Formulario inválido:', this.passwordForm.errors);
      console.log('Errores por campo:', {
        old_password: this.passwordForm.get('old_password')?.errors,
        new_password: this.passwordForm.get('new_password')?.errors,
        confirm_password: this.passwordForm.get('confirm_password')?.errors
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}