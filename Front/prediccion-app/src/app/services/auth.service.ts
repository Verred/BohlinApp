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
  access: string;
  refresh: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://127.0.0.1:8000/api/auth';
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
    return this.http.post<AuthResponse>(`${this.API_URL}/login/`, { username, password })
      .pipe(
        tap((response: AuthResponse) => {
          localStorage.setItem('access_token', response.access);
          localStorage.setItem('refresh_token', response.refresh);
          localStorage.setItem('user', JSON.stringify(response.user));
          this.currentUserSubject.next(response.user);
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Login error:', error);
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

  changePassword(oldPassword: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.API_URL}/change-password/`, {
      old_password: oldPassword,
      new_password: newPassword
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Change password error:', error);
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
    return token !== null && !this.isTokenExpired(token);
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