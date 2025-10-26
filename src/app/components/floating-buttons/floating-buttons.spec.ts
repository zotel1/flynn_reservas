import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FloatingButtons } from './floating-buttons';

describe('FloatingButtons', () => {
  let component: FloatingButtons;
  let fixture: ComponentFixture<FloatingButtons>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FloatingButtons]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FloatingButtons);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
