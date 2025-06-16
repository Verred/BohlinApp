import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
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
    private router: Router,
    private snackBar: MatSnackBar,
    private location: Location
  ) {
    this.passwordForm = this.fb.group({
      old_password: ['', [Validators.required]],
      new_password: ['', [
        Validators.required,
        Validators.minLength(8),
        this.passwordComplexityValidator,
        this.noCommonPasswordValidator
      ]],
      confirm_password: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  /**
   * Validador personalizado para complejidad de contraseña
   */
  passwordComplexityValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) {
      return null;
    }

    const hasLetter = /[a-zA-Z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
    
    const errors: any = {};
    
    if (!hasLetter) {
      errors.noLetter = true;
    }
    
    if (!hasNumber) {
      errors.noNumber = true;
    }
    
    // Solo agregar validación de carácter especial si tu Django lo requiere
    // if (!hasSpecialChar) {
    //   errors.noSpecialChar = true;
    // }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  /**
   * Validador para contraseñas comunes
   */
  noCommonPasswordValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) {
      return null;
    }

    const commonPasswords = [
      '123456', 'password', '123456789', '12345678', '12345',
      '1234567', '1234567890', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', 'dragon'
    ];

    if (commonPasswords.includes(value.toLowerCase())) {
      return { commonPassword: true };
    }

    return null;
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
      
      const formData = this.passwordForm.value;
      console.log('Enviando datos de cambio de contraseña:', {
        old_password: formData.old_password ? '***' : 'vacío',
        new_password: formData.new_password ? '***' : 'vacío',
        confirm_password: formData.confirm_password ? '***' : 'vacío'
      });
      
      this.authService.changePassword(
        formData.old_password,
        formData.new_password,
        formData.confirm_password
      ).subscribe({
        next: (response) => {
          this.isLoading = false;
          console.log('Contraseña cambiada exitosamente:', response);
          
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
            // Mostrar errores específicos de validación de Django
            const errors = error.error.errors;
            if (errors.old_password) {
              errorMessage = `Contraseña actual: ${errors.old_password[0]}`;
            } else if (errors.new_password) {
              // Manejar múltiples errores de nueva contraseña
              const passwordErrors = errors.new_password;
              if (Array.isArray(passwordErrors)) {
                // Mapear errores comunes de Django a mensajes más amigables
                const friendlyMessages = passwordErrors.map(err => this.getFriendlyPasswordMessage(err));
                errorMessage = `Nueva contraseña: ${friendlyMessages.join('. ')}`;
              } else {
                errorMessage = `Nueva contraseña: ${passwordErrors}`;
              }
            } else if (errors.confirm_password) {
              errorMessage = `Confirmar contraseña: ${errors.confirm_password[0]}`;
            } else if (errors.non_field_errors) {
              // Manejar errores que no están asociados a un campo específico
              const nonFieldErrors = errors.non_field_errors;
              if (Array.isArray(nonFieldErrors)) {
                const friendlyMessages = nonFieldErrors.map(err => this.getFriendlyPasswordMessage(err));
                errorMessage = friendlyMessages.join('. ');
              } else {
                errorMessage = this.getFriendlyPasswordMessage(nonFieldErrors);
              }
            }
          } else if (error.error?.detail) {
            errorMessage = error.error.detail;
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.error?.non_field_errors) {
            // Manejar errores que vienen directamente en la raíz
            const nonFieldErrors = error.error.non_field_errors;
            if (Array.isArray(nonFieldErrors)) {
              const friendlyMessages = nonFieldErrors.map(err => this.getFriendlyPasswordMessage(err));
              errorMessage = friendlyMessages.join('. ');
            } else {
              errorMessage = this.getFriendlyPasswordMessage(nonFieldErrors);
            }
          }
          
          this.snackBar.open(errorMessage, 'Cerrar', {
            duration: 5000, // Aumentar duración para errores largos
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

  /**
   * Convierte mensajes de error de Django a mensajes más amigables en español
   */
  private getFriendlyPasswordMessage(errorMessage: string): string {
    const lowerError = errorMessage.toLowerCase();
    
    // Validación de longitud mínima
    if (lowerError.includes('at least 8 characters') || lowerError.includes('too short')) {
      return 'Debe tener al menos 8 caracteres';
    }
    
    // Validación de contraseña muy común
    if (lowerError.includes('too common') || lowerError.includes('common password') || lowerError.includes('this password is too common')) {
      return 'Esta contraseña es muy común, por favor elige una más segura';
    }
    
    // Validación de contraseña solo numérica
    if (lowerError.includes('entirely numeric') || lowerError.includes('only numbers')) {
      return 'La contraseña no puede contener solo números';
    }
    
    // Validación de similitud con información personal
    if (lowerError.includes('similar to') || lowerError.includes('too similar') || lowerError.includes('similar to the username')) {
      return 'La contraseña es muy similar a tu nombre de usuario';
    }
    
    // Validación de que contenga letras y números
    if (lowerError.includes('must contain') || lowerError.includes('letters and numbers')) {
      return 'Debe contener al menos una letra y un número';
    }
    
    // Validación de caracteres especiales (si está habilitada)
    if (lowerError.includes('special character')) {
      return 'Debe contener al menos un carácter especial (!@#$%^&*)';
    }
    
    // Validación de mayúsculas y minúsculas (si está habilitada)
    if (lowerError.includes('uppercase') || lowerError.includes('lowercase')) {
      return 'Debe contener letras mayúsculas y minúsculas';
    }
    
    // Si no coincide con ningún patrón conocido, devolver el mensaje original
    return errorMessage;
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}