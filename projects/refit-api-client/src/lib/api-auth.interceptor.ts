import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';

import { REFIT_AUTH_PROVIDER } from './tokens';

/**
 * HTTP interceptor that attaches an Authorization header using the configured
 * `REFIT_AUTH_PROVIDER` token. The provider may return a string token or a
 * Promise that resolves to a token. This interceptor converts both sync and
 * async tokens into an observable and then forwards the request.
 *
 * Important: the interceptor returns an Observable<HttpEvent<unknown>> (the
 * required contract) and does not use `async`/`await` on the `intercept`
 * method. Using `async` here would change the return type to a Promise and
 * break Angular's HTTP pipeline.
 */
@Injectable()
export class RefitAuthInterceptor implements HttpInterceptor {
  private authProvider = inject(REFIT_AUTH_PROVIDER, { optional: true }) as
    | (() => string | Promise<string> | null)
    | null;

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    // If no provider configured, forward the request unchanged.
    if (!this.authProvider) return next.handle(req);

    // The provider may return a string or a Promise<string>.
    const tokenOrPromise = this.authProvider();
    const token$ =
      tokenOrPromise instanceof Promise
        ? from(tokenOrPromise)
        : of(tokenOrPromise);

    // Take a single token value then switch to the HTTP handler observable.
    return token$.pipe(
      take(1),
      switchMap((token) => {
        if (!token) return next.handle(req);
        const clone = req.clone({ setHeaders: { Authorization: `${token}` } });
        return next.handle(clone);
      })
    );
  }
}
