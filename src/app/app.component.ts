import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LayoffsChartComponent } from './layoffs-chart/layoffs-chart.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LayoffsChartComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})

export class AppComponent {
  title = 'layoffs-visualization';
}
