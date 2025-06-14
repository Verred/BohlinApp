import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface AuthResponse {
  message: string;
  success: boolean;
  tokens: {
    access: string;
    refresh: string;
  };
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'https://bohlin-api.onrender.com/api/auth';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    this.loadCurrentUser();
  }

  private loadCurrentUser(): void {
    const token = this.getToken();
    if (token && !this.isTokenExpired(token)) {
      const userData = localStorage.getItem('user');
      if (userData) {
        this.currentUserSubject.next(JSON.parse(userData));
      }
    }
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login/`, { 
      username, 
      password 
    }).pipe(
      tap(response => {
        console.log('Guardando tokens:', response.tokens); // Debug
        
        // Guardar tokens en localStorage
        localStorage.setItem('access_token', response.tokens.access);
        localStorage.setItem('refresh_token', response.tokens.refresh);
        
        // Guardar información del usuario
        localStorage.setItem('user', JSON.stringify(response.user));
        
        // Actualizar el usuario actual
        this.currentUserSubject.next(response.user);
        
        console.log('Token guardado:', localStorage.getItem('access_token')); // Debug
      }),
      catchError(error => {
        console.error('Error en login:', error);
        return throwError(() => error);
      })
    );
  }

  refreshToken(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.logout();
      return throwError(() => new Error('No refresh token available'));
    }
    
    return this.http.post(`${this.API_URL}/refresh/`, { refresh: refreshToken })
      .pipe(
        tap((response: any) => {
          if (response.access) {
            localStorage.setItem('access_token', response.access);
          }
        }),
        catchError((error: HttpErrorResponse) => {
          this.logout();
          return throwError(() => error);
        })
      );
  }

  changePassword(oldPassword: string, newPassword: string, confirmPassword: string): Observable<any> {
    const token = this.getToken();
    
    // Debug: verificar el token
    console.log('Token para cambio de contraseña:', token);
    console.log('Token expirado?', this.isTokenExpired(token || ''));
    
    if (!token) {
      return throwError(() => new Error('No hay token de autenticación'));
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const body = {
      old_password: oldPassword,
      new_password: newPassword,
      confirm_password: confirmPassword
    };

    // Debug: mostrar el body que se envía
    console.log('Body enviado:', body);

    return this.http.post(`${this.API_URL}/change-password/`, body, { headers }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Change password error:', error);
        console.error('Error details:', error.error);
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    console.log('Verificando si está logueado. Token:', token); // Debug
    
    if (!token) {
      console.log('No hay token'); // Debug
      return false;
    }
    
    const isExpired = this.isTokenExpired(token);
    console.log('Token expirado:', isExpired); // Debug
    
    return !isExpired;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      return Date.now() >= exp;
    } catch (error) {
      return true;
    }
  }
}