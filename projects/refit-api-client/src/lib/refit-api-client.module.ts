import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { ModuleWithProviders, NgModule } from '@angular/core';
import {
  REFIT_AUTH_PROVIDER,
  REFIT_BASE_URL,
  REFIT_GLOBAL_HEADERS,
} from './tokens';

import { RefitAuthInterceptor } from './api-auth.interceptor';
import { RefitClientFactory } from './refit-client-factory.service';

@NgModule({
  imports: [HttpClientModule],
  providers: [RefitClientFactory],
})
export class RefitApiClientModule {
  static forRoot(config: {
    baseUrl?: string;
    globalHeaders?: Record<string, string>;
    authProvider?: () => string | Promise<string> | null;
    useInterceptor?: boolean;
  }): ModuleWithProviders<RefitApiClientModule> {
    return {
      ngModule: RefitApiClientModule,
      providers: [
        { provide: REFIT_BASE_URL, useValue: config.baseUrl || '' },
        { provide: REFIT_GLOBAL_HEADERS, useValue: config.globalHeaders || {} },
        { provide: REFIT_AUTH_PROVIDER, useValue: config.authProvider },
        ...(config.useInterceptor
          ? [
              {
                provide: HTTP_INTERCEPTORS,
                useClass: RefitAuthInterceptor,
                multi: true,
              },
            ]
          : []),
      ],
    };
  }
}
