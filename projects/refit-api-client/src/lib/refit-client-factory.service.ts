import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import {
  REFIT_AUTH_PROVIDER,
  REFIT_BASE_URL,
  REFIT_GLOBAL_HEADERS,
} from './tokens';
import { switchMap, take } from 'rxjs/operators';

import { __REFIT_META } from './decorators';

type ParamType = 'path' | 'query' | 'header' | 'body';

interface ParamMeta {
  index: number;
  type: ParamType;
  name?: string;
}

interface MethodMeta {
  path?: string;
  httpMethod?: string;
  params?: ParamMeta[];
  headers?: Record<string, string>;
}

type MetaRecord = Record<string, MethodMeta>;

type AuthResult =
  | string
  | null
  | undefined
  | Promise<string | null | undefined>
  | Observable<string | null | undefined>;
type AuthProvider = () => AuthResult;

@Injectable({ providedIn: 'root' })
export class RefitClientFactory {
  private http = inject(HttpClient);
  private baseUrl = inject(REFIT_BASE_URL, { optional: true }) as
    | string
    | undefined;
  private globalHeaders = inject(REFIT_GLOBAL_HEADERS, { optional: true }) as
    | HttpHeaders
    | Record<string, string>
    | undefined;
  private authProvider = inject(REFIT_AUTH_PROVIDER, { optional: true }) as
    | AuthProvider
    | undefined;

  create<T>(apiClass: new (...args: unknown[]) => unknown): T {
    // The factory reads metadata written by the decorators and returns a Proxy
    // that maps method calls to HttpClient requests. Methods return
    // `Observable<unknown>` so consumers can subscribe normally.
    const proto = (apiClass as { prototype: Record<string, unknown> })
      .prototype;
    const meta = ((proto && (proto as Record<string, unknown>)[__REFIT_META]) ||
      {}) as MetaRecord;

    // Capture instance to use inside proxy handler (avoid using `this` there)
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const factory = this;

    const handler: ProxyHandler<object> = {
      get(_target, prop: string | symbol) {
        if (typeof prop === 'symbol') return undefined;
        const key = String(prop);
        const m: MethodMeta | undefined = meta[key];
        if (!m) return undefined;

        return (...args: unknown[]): Observable<unknown> => {
          // Build URL and request options synchronously
          const http = factory.http;
          let url = (factory.baseUrl ?? '') + (m.path ?? '');

          const argArray = args as unknown[];

          // apply path params
          (m.params ?? []).forEach((p: ParamMeta) => {
            if (p && p.type === 'path') {
              const raw = argArray[p.index];
              const val = encodeURIComponent(
                raw === undefined || raw === null ? '' : String(raw)
              );
              const name = p.name ?? String(p.index);
              url = url.replace(new RegExp(`\\{${name}\\}`, 'g'), val);
            }
          });

          // query params
          let httpParams = new HttpParams();
          (m.params ?? []).forEach((p: ParamMeta) => {
            if (p && p.type === 'query') {
              const name = p.name ?? String(p.index);
              const val = argArray[p.index];
              if (val !== undefined && val !== null)
                httpParams = httpParams.append(name, String(val));
            }
          });

          // headers (start from global headers without mutating original)
          let headers: HttpHeaders;
          const gh = factory.globalHeaders;
          if (gh instanceof HttpHeaders) {
            headers = gh;
          } else {
            headers = new HttpHeaders(gh ?? {});
          }

          // per-parameter headers
          (m.params ?? []).forEach((p: ParamMeta) => {
            if (p && p.type === 'header') {
              const name = p.name ?? String(p.index);
              const val = argArray[p.index];
              if (val != null) headers = headers.set(name, String(val));
            }
          });

          // per-method headers (if decorators added them under m.headers)
          if (m.headers && typeof m.headers === 'object') {
            Object.keys(m.headers).forEach((h: string) => {
              const v = m.headers && m.headers[h];
              if (v != null) headers = headers.set(h, String(v));
            });
          }

          let body: unknown = undefined;
          const bodyParam = (m.params ?? []).find(
            (p) => p && p.type === 'body'
          );
          if (bodyParam) body = argArray[bodyParam.index];
          else if (
            ['POST', 'PUT', 'PATCH'].includes(
              (m.httpMethod ?? 'GET').toUpperCase()
            ) &&
            argArray.length
          ) {
            body = argArray.find(
              (_, i) =>
                !(m.params ?? []).some(
                  (p) => p && p.index === i && p.type !== 'body'
                )
            );
          }

          const options = {
            headers,
            params: httpParams,
            observe: 'body' as const,
          };

          const httpMethod = (m.httpMethod ?? 'GET').toUpperCase();

          // If authProvider exists and may be async, convert to observable and attach header
          if (factory.authProvider) {
            try {
              const tokenOrPromiseOrObs = factory.authProvider();
              let token$: Observable<string | null | undefined>;

              if (tokenOrPromiseOrObs instanceof Promise) {
                token$ = from(tokenOrPromiseOrObs);
              } else if (
                tokenOrPromiseOrObs &&
                typeof (tokenOrPromiseOrObs as Observable<unknown>)[
                  'subscribe'
                ] === 'function'
              ) {
                token$ = tokenOrPromiseOrObs as Observable<
                  string | null | undefined
                >;
              } else {
                token$ = of(tokenOrPromiseOrObs as string | null | undefined);
              }

              return token$.pipe(
                take(1),
                switchMap((token) => {
                  let reqHeaders = headers;
                  if (token)
                    reqHeaders = reqHeaders.set('Authorization', String(token));
                  return http.request<unknown>(httpMethod, url, {
                    ...options,
                    headers: reqHeaders,
                    body,
                  });
                })
              );
            } catch {
              // If authProvider call throws, fall back to direct request
            }
          }

          // No auth provider: return request observable directly
          return http.request<unknown>(httpMethod, url, {
            ...options,
            body,
          });
        };
      },
    };

    return new Proxy({}, handler) as T;
  }
}
