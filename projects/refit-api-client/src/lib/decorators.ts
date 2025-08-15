/**
 * Refit-style decorators metadata storage and helpers.
 *
 * This file provides a tiny, runtime metadata model used by the Refit client
 * factory to build HttpClient requests from decorated abstract classes.
 *
 * Key points:
 * - Metadata is stored non-enumerably on the class prototype so it does not
 *   leak into normal object iteration.
 * - Method decorators (GET/POST/...) record method-level data (HTTP verb, path,
 *   optional static headers) and preserve any parameter metadata added by
 *   parameter decorators.
 * - Parameter decorators (Path/Query/Header/Body) store metadata indexed by
 *   parameter position for deterministic lookup when the factory builds
 *   requests.
 *
 * Usage example:
 *
 *   abstract class TodoApi {
 *     @GET('/todos/{id}')
 *     abstract get(@Path('id') id: number): Observable<Todo>;
 *
 *     @POST('/todos')
 *     abstract create(@Body() payload: Partial<Todo>): Observable<Todo>;
 *   }
 */

/** Symbol key used to attach metadata to prototypes. */
export const __REFIT_META = '__REFIT_META';

/** Metadata for a single parameter. */
interface ParamMeta {
  type: 'path' | 'query' | 'header' | 'body';
  name?: string; // optional name (eg. path or query key)
  index: number; // parameter position
}

/** Metadata describing an HTTP method for a decorated function. */
interface MethodMeta {
  httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  headers?: Record<string, string>;
  // params is a sparse array indexed by parameter position
  params?: ParamMeta[];
}

/**
 * Ensure the prototype has a non-enumerable metadata container and return it.
 *
 * We attach metadata directly to the prototype rather than using Reflect to keep
 * the runtime dependency small. The container is created as a non-enumerable
 * property so it doesn't interfere with normal property enumeration.
 */
function ensureMeta(target: object) {
  if (!Object.prototype.hasOwnProperty.call(target, __REFIT_META)) {
    Object.defineProperty(target, __REFIT_META, {
      value: {},
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }

  return (target as Record<string, unknown>)[__REFIT_META as string] as Record<
    string,
    MethodMeta
  >;
}

/**
 * Base factory used by method decorators.
 *
 * @param httpMethod HTTP verb
 * @param path URL path (may contain `{name}` tokens for path parameters)
 * @param headers Optional static headers for this method
 * @returns Method decorator function
 */
export function methodDecorator(
  httpMethod: MethodMeta['httpMethod'],
  path: string,
  headers?: Record<string, string>
) {
  return function (target: object, propertyKey: string | symbol) {
    const meta = ensureMeta(target);
    // preserve any parameter metadata that may have been added earlier
    const existing = meta[propertyKey as string] || { params: [] };
    meta[propertyKey as string] = {
      httpMethod,
      path,
      headers: headers || {},
      params: existing.params || [],
    };
  };
}

/** Method decorators */
export const GET = (path: string, headers?: Record<string, string>) =>
  methodDecorator('GET', path, headers);
export const POST = (path: string, headers?: Record<string, string>) =>
  methodDecorator('POST', path, headers);
export const PUT = (path: string, headers?: Record<string, string>) =>
  methodDecorator('PUT', path, headers);
export const DELETE = (path: string, headers?: Record<string, string>) =>
  methodDecorator('DELETE', path, headers);

/**
 * Parameter decorator factory.
 *
 * Parameter metadata is stored by parameter index. This makes it easy for the
 * client factory to map runtime arguments to path/query/header/body slots.
 */
function paramDecoratorFactory(type: ParamMeta['type'], name?: string) {
  return function (
    target: object,
    _propertyKey: string | symbol,
    parameterIndex: number
  ) {
    const key = _propertyKey as string;
    const meta = ensureMeta(target);
    meta[key] = meta[key] || { httpMethod: 'GET', path: '', params: [] };
    meta[key].params = meta[key].params || [];
    // store param metadata by parameter index for deterministic lookup
    meta[key].params![parameterIndex] = { type, name, index: parameterIndex };
  };
}

/** Parameter decorators */
export const Path = (name?: string) => paramDecoratorFactory('path', name);
export const Query = (name?: string) => paramDecoratorFactory('query', name);
export const Header = (name?: string) => paramDecoratorFactory('header', name);
export const Body = () => paramDecoratorFactory('body', undefined);

// NOTE: the Refit client factory expects this metadata shape. If you change the
// structure, update the factory accordingly.
