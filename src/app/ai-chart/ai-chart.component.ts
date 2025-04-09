// src/app/ai-chart/ai-chart.component.ts
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../services/data.service';
import * as d3 from 'd3';

interface AIDataPoint {
year: number;
metric: string;
value: number;
}

@Component({
selector: 'app-ai-chart',
standalone: true,
imports: [CommonModule],
templateUrl: './ai-chart.component.html',
styleUrls: ['./ai-chart.component.css'],
encapsulation: ViewEncapsulation.None
})
export class AIChartComponent implements OnInit {
private data: AIDataPoint[] = [];
private svg: any;
private margin = {top: 50, right: 80, bottom: 200, left: 60}; // Increased right margin for second y-axis
private width = 1200 - this.margin.left - this.margin.right;
private height = 500 - this.margin.top - this.margin.bottom;

// Make metrics public so they can be accessed in the template
public metrics: string[] = [];

// Array to store colors - made public so it can be accessed in the template
public colors: string[] = [
  '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', 
  '#59a14f', '#edc949', '#af7aa1', '#ff9da7',
  '#9c755f', '#bab0ab', '#d37295', '#6b4c9a'
];
private visibleMetrics: Set<string> = new Set(); // Track which metrics are visible (only AI Adoption initially)

constructor(private dataService: DataService) {}

ngOnInit(): void {
  this.dataService.getAIPercentageData().subscribe(data => {
    this.data = data;
    
    // Get unique metrics
    this.metrics = Array.from(new Set(data.map(d => d.metric)));
    
    // Initialize only "AI Adoption" as visible, all others hidden
    this.metrics.forEach(metric => {
      if (metric === "AI Adoption" || metric === "AI Adoption (%)") {
        this.visibleMetrics.add(metric);
      }
    });
    
    // Add sample data for new metrics if needed
    this.addSampleDataIfNeeded();
    
    // Create SVG and draw the chart AFTER data is ready
    this.createSvg();
    this.drawChart();
  });
}

/**
 * Add sample data for the new metrics if they're not already in the dataset
 * This is just for demonstration purposes
 */
private addSampleDataIfNeeded(): void {
  const requiredMetrics = [
    'Organizations Using AI',
    'Organizations Planning to Implement AI',
    'Estimated Jobs Eliminated by AI (millions)',
    'Estimated New Jobs Created by AI (millions)',
    'Net Job Loss in the US'
  ];
  
  const existingMetrics = new Set(this.metrics);
  const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  let dataModified = false;
  
  requiredMetrics.forEach(metric => {
    if (!existingMetrics.has(metric)) {
      // Add sample data for this metric
      const isJob = metric.includes('Jobs') || metric.includes('Job Loss');
      
      years.forEach(year => {
        // Generate some sample values based on the metric type
        let value;
        if (isJob) {
          // Job metrics in millions (0-10 range)
          if (metric.includes('Eliminated')) {
            value = 0.5 + (year - 2018) * 0.7; // Increasing from 0.5 to ~5.4 million
          } else if (metric.includes('Created')) {
            value = 0.3 + (year - 2018) * 0.5; // Increasing from 0.3 to ~3.8 million
          } else if (metric.includes('Net')) {
            value = 0.2 + (year - 2018) * 0.2; // Increasing from 0.2 to ~1.6 million
          }
        } else {
          // Percentage values (0-100 range)
          if (metric.includes('Using')) {
            value = 10 + (year - 2018) * 7; // Increasing from 10% to ~59%
          } else if (metric.includes('Planning')) {
            value = 20 + (year - 2018) * 5; // Increasing from 20% to ~55%
          }
        }
        
        // Add to data array
        this.data.push({
          year,
          metric,
          value: value ?? 0
        });
      });
      
      // Add to metrics array if not already there
      if (!this.metrics.includes(metric)) {
        this.metrics.push(metric);
      }
      
      dataModified = true;
    }
  });
}

private createSvg(): void {
  // Remove any existing SVG
  d3.select('figure#ai-chart').select('svg').remove();
  
  // Create SVG
  this.svg = d3.select('figure#ai-chart')
    .append('svg')
    .attr('width', this.width + this.margin.left + this.margin.right)
    .attr('height', this.height + this.margin.top + this.margin.bottom)
    .append('g')
    .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
}

private drawChart(): void {
  // Clear previous elements
  this.svg.selectAll('*').remove();
  
  // Group data by metric
  const groupedData: { [key: string]: AIDataPoint[] } = {};
  this.metrics.forEach(metric => {
    groupedData[metric] = this.data.filter(d => d.metric === metric);
  });

  // X scale - using years only, no quarters
  const xScale = d3.scaleLinear()
    .domain([
      d3.min(this.data, d => d.year) || 0,
      d3.max(this.data, d => d.year) || 0
    ])
    .range([0, this.width]);
    
  // Create a time scale for annotations
  const xTimeScale = d3.scaleTime()
    .domain([new Date('2018-01-01'), new Date('2026-01-01')])
    .range([0, this.width]);

  // Y scale - separate for percentage and absolute values
  const percentageYScale = d3.scaleLinear()
    .domain([0, 100]) // Percentage metrics go from 0 to 100
    .range([this.height, 0]);
    
  // Y scale for job numbers (in millions)
  const jobsYScale = d3.scaleLinear()
    .domain([
      d3.min(this.data.filter(d => !this.isPercentageMetric(d.metric)), d => d.value) || 0,
      d3.max(this.data.filter(d => !this.isPercentageMetric(d.metric)), d => d.value) || 10
    ])
    .range([this.height, 0]);

  // Function to determine which y-scale to use
  const getYScale = (metric: string) => {
    return this.isPercentageMetric(metric) ? percentageYScale : jobsYScale;
  };

  // Line generator with dynamic y-scale
  const line = d3.line<AIDataPoint>()
    .x(d => xScale(d.year))
    .y(d => getYScale(d.metric)(d.value));

  // Add X axis - using years only
  const xAxis = this.svg.append('g')
    .attr('transform', `translate(0,${this.height})`)
    .call(d3.axisBottom(xScale)
      .tickFormat((d: any) => d.toString())); // Ensure we only show whole years

  xAxis.selectAll('text')
    .style('font-size', '12px')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end');

  // Add X axis label
  this.svg.append('text')
    .attr('x', this.width / 2)
    .attr('y', this.height + 190) // Position below legend
    .attr('text-anchor', 'middle')
    .style('font-size', '14px')
    .text('Year');

  // Add left Y axis (for percentage values)
  this.svg.append('g')
    .call(d3.axisLeft(percentageYScale))
    .selectAll('text')
    .style('font-size', '12px');

  // Y axis label for percentages
  this.svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -this.margin.left + 5)
    .attr('x', -this.height / 2)
    .attr('dy', '1em')
    .style('text-anchor', 'middle')
    .text('Percentage (%)');

  // Add right Y axis (for job numbers)
  this.svg.append('g')
    .attr('transform', `translate(${this.width}, 0)`)
    .call(d3.axisRight(jobsYScale))
    .selectAll('text')
    .style('font-size', '12px');

  // Y axis label for job numbers
  this.svg.append('text')
    .attr('transform', 'rotate(90)')
    .attr('y', -this.width - 50)
    .attr('x', this.height / 2)
    .attr('dy', '1em')
    .style('text-anchor', 'middle')
    .text('Jobs (millions)');

  // Add chart title
  this.svg.append('text')
    .attr('x', this.width / 2)
    .attr('y', -this.margin.top / 2)
    .attr('text-anchor', 'middle')
    .style('font-size', '20px')
    .style('font-weight', 'bold')
    .text('Rise of AI - Metrics Over Time (2018-2025)');

  // Add vertical grid lines for years
  const yearTicks = d3.range(
    Math.floor(d3.min(this.data, d => d.year) || 0),
    Math.ceil(d3.max(this.data, d => d.year) || 0) + 1
  );
  
  this.svg.selectAll('grid-line')
    .data(yearTicks)
    .enter()
    .append('line')
    .attr('x1', (d: d3.NumberValue) => xScale(d))
    .attr('x2', (d: d3.NumberValue) => xScale(d))
    .attr('y1', 0)
    .attr('y2', this.height)
    .attr('stroke', '#c0c0c0')
    .attr('stroke-width', 0.5);
    
  // Add custom annotations
  this.addCustomAnnotations(xTimeScale, percentageYScale);

  // Draw lines only for visible metrics
  this.metrics.forEach((metric, i) => {
    if (groupedData[metric].length > 0 && this.visibleMetrics.has(metric)) {
      this.svg.append('path')
        .datum(groupedData[metric])
        .attr('id', `line-${this.sanitizeId(metric)}`) // Add ID for toggling visibility
        .attr('fill', 'none')
        .attr('stroke', this.colors[i % this.colors.length])
        .attr('stroke-width', 2)
        .attr('d', line as any);
    }
  });

  // Add data points only for visible metrics
  this.metrics.forEach((metric, i) => {
    if (this.visibleMetrics.has(metric)) {
      this.svg.selectAll(`.dot-${this.sanitizeId(metric)}`)
        .data(groupedData[metric])
        .enter()
        .append('circle')
        .attr('class', `dot-${this.sanitizeId(metric)}`)
        .attr('cx', (d: { year: d3.NumberValue; }) => xScale(d.year))
        .attr('cy', (d: { value: d3.NumberValue; }) => getYScale(metric)(d.value))
        .attr('r', 4)
        .attr('fill', this.colors[i % this.colors.length]);
    }
  });

  // Add legend with checkboxes for toggling metric visibility
  const legendX = 0;
  const legendY = this.height + 40; // Position below the x-axis
  
  const legend = this.svg.append('g')
    .attr('transform', `translate(${legendX}, ${legendY})`);
  
  // Configuration for multi-column legend
  const itemsPerRow = 3; // Reduced items per row to provide more space for full text
  const itemWidth = 330; // Increased width for each legend item to fit full text
  const itemHeight = 25; // Increased height for each legend item to fit checkbox
  
  // Create the legend items with checkboxes
  this.metrics.forEach((metric, i) => {
    // Calculate row and column for this legend item
    const rowIndex = Math.floor(i / itemsPerRow);
    const columnIndex = i % itemsPerRow;
    
    const legendItem = legend.append('g')
      .attr('transform', `translate(${columnIndex * itemWidth}, ${rowIndex * itemHeight})`);
    
    // Create checkbox
    const checkbox = legendItem.append('rect')
      .attr('width', 10)
      .attr('height', 10)
      .attr('x', 0)
      .attr('y', 0)
      .attr('stroke', '#000')
      .attr('stroke-width', 1)
      .attr('fill', this.visibleMetrics.has(metric) ? this.colors[i % this.colors.length] : 'white')
      .style('cursor', 'pointer')
      .attr('id', `checkbox-${this.sanitizeId(metric)}`);
    
    // Color box (as before)
    legendItem.append('rect')
      .attr('width', 10)
      .attr('height', 10)
      .attr('x', 20)
      .attr('y', 0)
      .attr('fill', this.colors[i % this.colors.length]);
    
    // Metric label
    legendItem.append('text')
      .attr('x', 35)
      .attr('y', 10)
      .attr('text-anchor', 'start')
      .style('font-size', '11px')
      .text(metric);
      
    // Add axis indicator (left or right)
    legendItem.append('text')
      .attr('x', 300)
      .attr('y', 10)
      .attr('text-anchor', 'end')
      .style('font-size', '10px')
      .style('font-style', 'italic')
      .text(this.isPercentageMetric(metric) ? '' : ' (Right axis)');
    
    // Add click event to toggle visibility
    legendItem.style('cursor', 'pointer')
      .on('click', () => {
        // Toggle the metric's visibility
        if (this.visibleMetrics.has(metric)) {
          this.visibleMetrics.delete(metric);
        } else {
          this.visibleMetrics.add(metric);
        }
        
        // Update the checkbox appearance
        d3.select(`#checkbox-${this.sanitizeId(metric)}`)
          .attr('fill', this.visibleMetrics.has(metric) ? this.colors[i % this.colors.length] : 'white');
        
        // Redraw the chart with the updated visible metrics
        this.drawChart();
      });
  });

  // Add tooltip
  const tooltip = d3.select('body').select('.tooltip');
  if (tooltip.empty()) {
    d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background-color', 'white')
      .style('border', '1px solid #ddd')
      .style('padding', '10px')
      .style('border-radius', '4px')
      .style('pointer-events', 'none')
      .style('font-size', '12px');
  }

  // Add hover functionality for visible metrics
  this.metrics.forEach((metric, i) => {
    if (this.visibleMetrics.has(metric)) {
      this.svg.selectAll(`.dot-${this.sanitizeId(metric)}`)
        .on('mouseover', (event: any, d: AIDataPoint) => {
          d3.select('body').select('.tooltip')
            .transition()
            .duration(200)
            .style('opacity', .9);
          
          // Format the value based on the metric type
          const formattedValue = this.isPercentageMetric(metric) 
            ? `${d.value.toFixed(1)}%` 
            : `${d.value.toFixed(1)} million`;
            
          d3.select('body').select('.tooltip')
            .html(`<strong>${metric}</strong><br>Year: ${d.year}<br>Value: ${formattedValue}`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', () => {
          d3.select('body').select('.tooltip')
            .transition()
            .duration(500)
            .style('opacity', 0);
        });
    }
  });
}
/**
   * Sanitizes a metric name to be used as a CSS ID
   */
private sanitizeId(text: string): string {
  return text.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}
/**
 * Calculate the percentage change from 2018 to 2025 for a given metric
 * @param metric The metric name to calculate change for
 * @returns The percentage change value
 */
public getPercentageChange(metric: string): number {
  const metricData = this.data.filter(d => d.metric === metric);
  
  // Find the 2018 and 2025 data points (or closest years)
  const startYear = 2018;
  const endYear = 2025;
  
  const startData = metricData.find(d => d.year === startYear);
  const endData = metricData.find(d => d.year === endYear);
  
  // If we don't have exact year matches, return 0 or handle differently
  if (!startData || !endData) {
    return 0;
  }
  
  // Calculate the percentage change
  const startValue = startData.value;
  const endValue = endData.value;
  
  // Calculate absolute change and percentage change
  const absoluteChange = endValue - startValue;
  
  // Return the change in percentage points (not percentage of original)
  return absoluteChange;
}

/**
 * Determine if a metric should be displayed as a percentage or absolute value
 * @param metric The metric name to check
 * @returns True if the metric should be displayed as a percentage
 */
public isPercentageMetric(metric: string): boolean {
  // These metrics are not percentages
  const nonPercentageMetrics = [
    'Estimated Jobs Eliminated by AI (millions)',
    'Estimated New Jobs Created by AI (millions)',
    'Net Job Loss in the US'
  ];
  
  return !nonPercentageMetrics.includes(metric);
}

/**
 * Format the value based on whether it's a percentage or absolute number
 * @param metric The metric name
 * @param value The value to format
 * @returns Formatted value as string
 */
public formatValue(metric: string, value: number): string {
  if (this.isPercentageMetric(metric)) {
    return value.toFixed(1) + '%';
  } else {
    // For job numbers in millions
    return value.toFixed(1);
  }
}

/**
 * Add custom annotations to the chart
 * @param x D3 time scale
 * @param y D3 linear scale for values
 */
private addCustomAnnotations(
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleLinear<number, number>
): void {
  // Create an annotation group
  const annotationGroup = this.svg.append('g')
    .attr('class', 'annotation-group');

  // Define annotation data - vertical line annotations
  const verticalAnnotations = [
    { date: '2020-03-10', label: "OpenAI GPT-3" },
    { date: '2021-01-15', label: "OpenAI Dall-E" },
    { date: '2022-07-01', label: "Google SWE (Blake Lemone) Fired" },
    { date: '2022-11-01', label: "OpenAI released ChatGPT interface" },
    { date: '2023-02-15', label: "Mirosoft integrated ChatGPT into Bing" },
    { date: '2023-03-01', label: "OpenAI announced GPT-4" },
    { date: '2023-03-30', label: "Google released GPT chatbot Bard" }
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
    30, 50,                       // Value range (min, max) - adjusted for percentage scale
    'COVID-19 Pandemic',         // Label
    'peak-period',               // CSS class name
    'rgba(255, 165, 0, 0.15)',   // Fill color (light orange with transparency)
    '#FF7039'                    // Stroke color (dark orange)
  );
}

/**
 * Add a rectangle annotation to highlight a specific time period
 */
private addRectangleAnnotation(
  annotationGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  x: d3.ScaleTime<number, number>,
  y: d3.ScaleLinear<number, number>,
  startDate: string,
  endDate: string,
  minValue: number,
  maxValue: number,
  label: string,
  className: string,
  fillColor: string,
  strokeColor: string
): void {
  // Calculate positions
  const startX = x(new Date(startDate));
  const endX = x(new Date(endDate));
  const startY = y(maxValue);
  const endY = y(minValue);

  // Add rectangle
  annotationGroup.append('rect')
    .attr('class', `annotation-rect ${className}`)
    .attr('x', startX)
    .attr('y', startY)
    .attr('width', endX - startX)
    .attr('height', endY - startY)
    .style('fill', fillColor)
    .style('stroke', strokeColor)
    .style('stroke-width', 1);
    
  // Add label inside the rectangle
  annotationGroup.append('text')
    .attr('class', 'annotation-rect-label')
    .attr('x', startX + (endX - startX) / 2)
    .attr('y', startY + 20)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .style('fill', '#884400')
    .text(label);
}
}