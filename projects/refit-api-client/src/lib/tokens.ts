import { InjectionToken } from '@angular/core';

export const REFIT_BASE_URL = new InjectionToken<string>('REFIT_BASE_URL');
export const REFIT_GLOBAL_HEADERS = new InjectionToken<Record<string, string>>(
  'REFIT_GLOBAL_HEADERS'
);
export type AuthTokenProvider = () => string | Promise<string> | null;
export const REFIT_AUTH_PROVIDER = new InjectionToken<AuthTokenProvider>(
  'REFIT_AUTH_PROVIDER'
);
