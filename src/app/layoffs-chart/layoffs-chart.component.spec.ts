import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LayoffsChartComponent } from './layoffs-chart.component';

describe('LayoffsChartComponent', () => {
  let component: LayoffsChartComponent;
  let fixture: ComponentFixture<LayoffsChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoffsChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LayoffsChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
