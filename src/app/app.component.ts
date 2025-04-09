import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LayoffsChartComponent } from './layoffs-chart/layoffs-chart.component';
import { LayoffsMapComponent } from './layoffs-map/layoffs-map.component';
import { AIChartComponent } from './ai-chart/ai-chart.component';



@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LayoffsChartComponent, LayoffsMapComponent, AIChartComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})

export class AppComponent {
  title = 'layoffs-visualization';
  mapTitle = 'app-layoffs-map';
}
