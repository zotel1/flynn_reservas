import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReservasDashboard } from './reservas-dashboard';

describe('ReservasDashboard', () => {
  let component: ReservasDashboard;
  let fixture: ComponentFixture<ReservasDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReservasDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReservasDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
