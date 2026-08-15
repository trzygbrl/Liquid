import { supabase } from './supabaseClient';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'patient' | 'doctor';

export async function signUpWithRole(email: string, password: string, role: UserRole) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { role } },
  });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function getRoleFromUser(user: User | null | undefined): UserRole | null {
  const role = user?.user_metadata?.role;
  return role === 'patient' || role === 'doctor' ? role : null;
}

export function dashboardRouteForRole(role: UserRole): string {
  return role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard';
}

export function authRouteForRole(role: UserRole): string {
  return role === 'doctor' ? '/doctor/auth' : '/patient/auth';
}
