// src/app/layoffs-chart/layoffs-chart.component.ts
import { Component, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';
import { DataService } from '../services/data.service';
import { LayoffData } from '../models/layoff-data';

@Component({
  selector: 'app-layoffs-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './layoffs-chart.component.html',
  styleUrls: ['./layoffs-chart.component.css']
})
export class LayoffsChartComponent implements OnInit {
  private svg!: d3.Selection<SVGGElement, unknown, null, undefined>;

  //d3.js constants for creating a line chart
  private margin = { top: 50, right: 50, bottom: 50, left: 70 };
  private width = 1200 - this.margin.left - this.margin.right;
  private height = 800 - this.margin.top - this.margin.bottom;

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
      .nice()
      .range([0, this.width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.total) || 0])
      .nice()
      .range([this.height, 0]);

    // Create line generator
    const line = d3.line<LayoffData>()
      .x(d => x(new Date(d.date)))
      .y(d => y(d.total))
      .curve(d3.curveMonotoneX);

    // Add X axis
    this.svg.append('g')
      .attr('transform', `translate(0,${this.height})`)
      .call(d3.axisBottom(x).ticks(20))
      .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)');

    // Add Y axis
    // this.svg.append('g')
    //   .call(d3.axisLeft(y).ticks(18));

    // Add horizontal grid lines
    this.svg.append('g')
    .attr('class', 'grid-lines')
    .call(d3.axisLeft(y)
    .ticks(10)
    .tickSize(-this.width))
    .style('stroke', '#e0e0e0')  // Add color directly
    .style('stroke-opacity', 0.2)  // Add opacity directly
    .style('shape-rendering', 'crispEdges');

    // Remove the domain line (the axis line itself)
    this.svg.selectAll('.grid-lines path')
    .style('stroke-width', 0);
      

    // Add Y axis label
    this.svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - this.margin.left)
      .attr('x', 0 - (this.height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .text('Number of Layoffs');

    // Add the line path element
    this.svg.append('path')
      .datum(data)
      .attr('class', 'line')
      .attr('d', line)
      .style('stroke', '#00ff08')  // Same green as your dots
      .style('fill', 'black')       // Ensure no fill
      .style('stroke-width', 1);   // Line thickness

    // Add tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(197, 235, 197, 0.9)')
      .style('border', '1px solid #ccc')
      .style('padding', '10px')
      .style('border-radius', '4px')
      .style('box-shadow', '0 0 10px rgba(0, 0, 0, 0.1)');

    // Add dots for data points
    this.svg.selectAll('.dot')
      .data(data)
      .enter().append('circle')
        .attr('class', 'dot')
        .attr('cx', d => x(new Date(d.date)))
        .attr('cy', d => y(d.total))
        .attr('r', 5)
        .style('fill', '#00ff08')
         // 3. Mouseover
        .on('mouseover', (event: MouseEvent, d: LayoffData) => {
          tooltip.transition()
            .duration(500)
            .style('opacity', 1);
          tooltip.html(`Date: ${d.date}<br/>Layoffs: ${d.total.toLocaleString()}`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .style('visibility', 'visible');
        })
        .on('mouseout', () => {
          tooltip.transition()
            .duration(200)
            .style('opacity', 0);
        });
  }
}