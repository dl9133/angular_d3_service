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
  ) { }

  ngOnInit() {
    this.loading = true;
    this.error = null;
    this.dataService.getLayoffsData().subscribe({
      next: (data) => {
        //console.log('Received data:', data.slice(0, 5));
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
      .style('stroke', '#078cbce6')  // Same green as your dots
      .style('fill', '#25ffe9e6')       // Ensure no fill
      .style('stroke-width', 1);   // Line thickness

    // Add tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', '#25ffe9e6')
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
      .style('fill', '#078cbce6')
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

    // Add annotations after creating the chart
    this.addCustomAnnotations(x, y);
  }

  private addCustomAnnotations(
    x: d3.ScaleTime<number, number>,
    y: d3.ScaleLinear<number, number>
  ): void {
    // Create an annotation group
    const annotationGroup = this.svg.append('g')
      .attr('class', 'annotation-group');

    // Define annotation data - vertical line annotations
    const verticalAnnotations = [
      { date: '2020-03-10', label: "Open AI GPT-3 LLM" },
      { date: '2021-01-15', label: "Open AI Dall-E" },
      { date: '2022-07-01', label: "Google SWE (Blake Lemone) Fired" },
      { date: '2022-11-01', label: "OpenAI released ChatGPT interface" },
      { date: '2023-02-15', label: "Microsoft integrated ChatGPT into Bing search engine." },
      { date: '2023-03-01', label: "OpenAI announced GPT-4,multimodal LLM capable of processing both text and image prompts" },
      { date: '2023-03-30', label: "Google released its GPT chatbot Bard" }
    ];

    // Add vertical line annotations
    verticalAnnotations.forEach(annotation => {
      const xPos = x(new Date(annotation.date));

      const annotationItem = annotationGroup.append('g')
        .attr('class', 'annotation vertical-annotation');

      // Add vertical line
      annotationItem.append('line')
        .attr('class', 'annotation-line')
        .attr('x1', xPos)
        .attr('y1', this.margin.top - 30) // Start above the chart
        .attr('x2', xPos)
        .attr('y2', this.height)
        .style('stroke', '#888')
        .style('stroke-width', 1)
        .style('stroke-dasharray', '3,3');

      // Add annotation label
      if(annotation.date === "2022-11-01"){
        annotationItem.append('text')
        .attr('class', 'annotation-label')
        .attr('x', xPos)
        .attr('y', this.margin.top - 10)
        .attr('text-anchor', 'left')
        .style('font-size', '20px')
        .style('font-weight', 'bold')
        .text(annotation.label);
      } else if(annotation.date === "2023-02-15") {        
        annotationItem.append('text')
        .attr('class', 'annotation-label')
        .attr('x', xPos)
        .attr('y', 60)
        .attr('text-anchor', 'left')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text(annotation.label);

      } else if(annotation.date === "2023-03-01") {
        annotationItem.append('text')
        .attr('class', 'annotation-label')
        .attr('x', xPos)
        .attr('y', 80)
        .attr('text-anchor', 'left')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text(annotation.label);

      }else if(annotation.date === "2023-03-30") {
        annotationItem.append('text')
        .attr('class', 'annotation-label')
        .attr('x', xPos)
        .attr('y',100)
        .attr('text-anchor', 'left')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text(annotation.label);

      }else {      
        annotationItem.append('text')
        .attr('class', 'annotation-label')
        .attr('x', xPos)
        .attr('y', this.margin.top - 35)
        .attr('text-anchor', 'left')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text(annotation.label);
      }

    });

  // ADD RECTANGLE ANNOTATIONS
  this.addRectangleAnnotation(
    annotationGroup,
    x, y,
    '2020-03-01', '2022-09-30',  // Date range
    30000, 50000,                 // Value range (min, max)
    'COVID-19 Pandemic',        // Label
    'peak-period',               // CSS class name
    'rgba(255, 165, 0, 0.95)',   // Fill color (light orange with transparency)
    '#FF7039'                    // Stroke color (dark orange)
  );
  }

  private addRectangleAnnotation(
    annotationGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    x: d3.ScaleTime<number, number>,
    y: d3.ScaleLinear<number, number>,
    startDate: string,
    endDate: string,
    minValue: number,
    maxValue: number,
    label: string,
    className: string = 'rectangle-annotation',
    fill: string = 'rgba(135, 206, 250, 0.2)', // Light blue with transparency
    stroke: string = '#4682B4'                 // Steel blue
  ): void {
    const startX = x(new Date(startDate));
    const endX = x(new Date(endDate));
    const startY = y(maxValue);
    const endY = y(minValue);
    const width = endX - startX;
    const height = endY - startY;
    
    // Create a group for the rectangle annotation
    const rectItem = annotationGroup.append('g')
      .attr('class', `annotation ${className}`);
    
    // Add the rectangle
    rectItem.append('rect')
      .attr('class', 'annotation-rect')
      .attr('x', startX)
      .attr('y', startY)
      .attr('width', width)
      .attr('height', height)
      .style('fill', fill)
      .style('stroke', stroke)
      .style('stroke-width', 1.5);
    
    // Add annotation label (centered on the rectangle)
    const labelX = startX + (width / 2);
    const labelY = startY + (height / 2);
    
    // Add a semi-transparent background for the text
    const textBg = rectItem.append('text')
      .attr('class', 'annotation-label-bg')
      .attr('x', labelX)
      .attr('y', labelY)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('stroke', 'white')
      .style('stroke-width', 6)
      .style('stroke-opacity', 0.7)
      .text(label);
    
    // Add the actual text on top
    rectItem.append('text')
      .attr('class', 'annotation-label')
      .attr('x', labelX)
      .attr('y', labelY)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text(label);
  }
}