import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    const isLoggedIn = this.authService.isLoggedIn();
    console.log('AuthGuard - Usuario logueado:', isLoggedIn); // Debug
    
    if (!isLoggedIn) {
      console.log('AuthGuard - Redirigiendo a login'); // Debug
      this.router.navigate(['/login']);
      return false;
    }
    
    console.log('AuthGuard - Acceso permitido'); // Debug
    return true;
  }
}