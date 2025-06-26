// src/app/layoffs-chart/layoffs-chart.component.ts
import { Component, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';
import { DataService } from '../data.service';
import { LayoffData } from '../models/layoff-data';

@Component({
  selector: 'app-layoffs-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container">
      <h2>Tech Industry Layoffs Timeline</h2>
      <div *ngIf="loading" class="loading">Loading data...</div>
      <div *ngIf="error" class="error">Error loading data: {{error}}</div>
      <div #chartContainer id="chartContainer"></div>
    </div>
  `,
  styles: [`
    .chart-container {
      width: 100%;
      padding: 20px;
    }
    .line {
      fill: none;
      stroke: #2196F3;
      stroke-width: 2;
    }
    .axis-label {
      font-size: 12px;
    }
    .tooltip {
      position: absolute;
      padding: 8px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
    }
  `]
})
export class LayoffsChartComponent implements OnInit {
  private svg!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private margin = { top: 50, right: 50, bottom: 50, left: 70 };
  private width = 960 - this.margin.left - this.margin.right;
  private height = 500 - this.margin.top - this.margin.bottom;

  loading = false;
  error: string | null = null;

  constructor(
    private elementRef: ElementRef,
    private dataService: DataService
  ) {}

  ngOnInit() {
    this.loading = true;
    this.error = null;
    
    this.dataService.getLayoffsData().subscribe({
      next: (data) => {
        console.log('Received data:', data.slice(0, 5));
        if (data.length === 0) {
          this.error = 'No data available';
        } else {
          this.createChart(data);
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading data:', err);
        this.error = 'Failed to load data';
        this.loading = false;
      }
    });
  }

  private createChart(data: LayoffData[]): void {
    // Clear any existing SVG
    d3.select(this.elementRef.nativeElement).select('svg').remove();

    // Create SVG
    const svg = d3.select(this.elementRef.nativeElement.querySelector('#chartContainer'))
      .append('svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom);
    
    this.svg = svg.append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    // Create scales
    const x = d3.scaleTime()
      .domain(d3.extent(data, d => new Date(d.date)) as [Date, Date])
      .range([0, this.width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.total) || 0])
      .range([this.height, 0]);

    // Create line generator
    const line = d3.line<LayoffData>()
      .x(d => x(new Date(d.date)))
      .y(d => y(d.total))
      .curve(d3.curveMonotoneX);

    // Add X axis
    this.svg.append('g')
      .attr('transform', `translate(0,${this.height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)');

    // Add Y axis
    this.svg.append('g')
      .call(d3.axisLeft(y));

    // Add Y axis label
    this.svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - this.margin.left)
      .attr('x', 0 - (this.height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .text('Number of Layoffs');

    // Add the line path
    this.svg.append('path')
      .datum(data)
      .attr('class', 'line')
      .attr('d', line);

    // Add tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);

    // Add dots for data points
    this.svg.selectAll('.dot')
      .data(data)
      .enter().append('circle')
        .attr('class', 'dot')
        .attr('cx', d => x(new Date(d.date)))
        .attr('cy', d => y(d.total))
        .attr('r', 3)
        .style('fill', '#2196F3')
        .on('mouseover', (event: MouseEvent, d: LayoffData) => {
          tooltip.transition()
            .duration(200)
            .style('opacity', .9);
          tooltip.html(`Date: ${d.date}<br/>Layoffs: ${d.total.toLocaleString()}`)
            .style('left', (event.pageX + 5) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', () => {
          tooltip.transition()
            .duration(500)
            .style('opacity', 0);
        });
  }
}