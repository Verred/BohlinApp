export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  tokens?: {
    access: string;
    refresh: string;
  };
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export interface User {
  id: number;
  username: string;
  email?: string;
}