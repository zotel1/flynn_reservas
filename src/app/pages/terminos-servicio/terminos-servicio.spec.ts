import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TerminosServicio } from './terminos-servicio';

describe('TerminosServicio', () => {
  let component: TerminosServicio;
  let fixture: ComponentFixture<TerminosServicio>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TerminosServicio]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TerminosServicio);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
