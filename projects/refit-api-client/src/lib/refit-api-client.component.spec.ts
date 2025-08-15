import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RefitApiClientComponent } from './refit-api-client.component';

describe('RefitApiClientComponent', () => {
  let component: RefitApiClientComponent;
  let fixture: ComponentFixture<RefitApiClientComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RefitApiClientComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RefitApiClientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
