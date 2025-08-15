import { TestBed } from '@angular/core/testing';

import { RefitApiClientService } from './refit-api-client.service';

describe('RefitApiClientService', () => {
  let service: RefitApiClientService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RefitApiClientService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
