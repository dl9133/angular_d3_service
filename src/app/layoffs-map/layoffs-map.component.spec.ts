import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LayoffsMapComponent } from './layoffs-map.component';

describe('LayoffsMapComponent', () => {
  let component: LayoffsMapComponent;
  let fixture: ComponentFixture<LayoffsMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoffsMapComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LayoffsMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
