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

 // Cache for metric values at specific years to avoid redundant calculations
 private metricValueCache: Map<string, Map<number, number>> = new Map();

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
    
    // Populate the cache with metric values
    this.populateMetricValueCache();
    
    // Create SVG and draw the chart AFTER data is ready
    this.createSvg();
    this.drawChart();
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
    .text('Global Rise of AI 2018-2025');

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
      .text(this.isPercentageMetric(metric) ? '' : '(Right axis)');
    
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
 * This version ensures compatibility with the linear year scale used in the main chart
 */
private addCustomAnnotations(
  timeScale: d3.ScaleTime<number, number>,
  y: d3.ScaleLinear<number, number>
): void {
  // Create an annotation group
  const annotationGroup = this.svg.append('g')
    .attr('class', 'annotation-group');

  // Define annotation data with exact year values (can include decimal for month precision)
  const annotations = [
    { year: 2020.19, label: "OpenAI GPT-3" },             // March 2020
    { year: 2021.04, label: "OpenAI Dall-E" },            // January 2021
    { year: 2022.5, label: "Google SWE (Blake Lemone) Fired" }, // July 2022
    { year: 2022.92, label: "OpenAI released ChatGPT interface" }, // Late November 2022
    { year: 2023.12, label: "Microsoft integrated ChatGPT into Bing" }, // February 2023
    { year: 2023.17, label: "OpenAI announced GPT-4" },    // March 2023
    { year: 2023.22, label: "Google released GPT chatbot Bard" } // March 2023
  ];

  // Get the same x scale that's used for the main chart
  const xScale = d3.scaleLinear()
    .domain([
      d3.min(this.data, d => d.year) || 2018,
      d3.max(this.data, d => d.year) || 2025
    ])
    .range([0, this.width]);

  // Add vertical line annotations
  annotations.forEach(annotation => {
    const xPos = xScale(annotation.year);

    const annotationItem = annotationGroup.append('g')
      .attr('class', 'annotation vertical-annotation');

    // Add vertical line
    annotationItem.append('line')
      .attr('class', 'annotation-line')
      .attr('x1', xPos)
      .attr('y1', -10) // Start above the chart
      .attr('x2', xPos)
      .attr('y2', this.height)
      .style('stroke', '#888')
      .style('stroke-width', 1)
      .style('stroke-dasharray', '3,3');

    // Position labels based on the specific annotation
    if (annotation.label === "OpenAI released ChatGPT interface") {
      annotationItem.append('text')
        .attr('class', 'annotation-label')
        .attr('x', xPos)
        .attr('y', 30)
        .attr('text-anchor', 'left')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text(annotation.label);
    } else if (annotation.label === "Microsoft integrated ChatGPT into Bing") {        
      annotationItem.append('text')
        .attr('class', 'annotation-label')
        .attr('x', xPos)
        .attr('y', 60)
        .attr('text-anchor', 'left')
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .text(annotation.label);
    } else if (annotation.label === "OpenAI announced GPT-4") {
      annotationItem.append('text')
        .attr('class', 'annotation-label')
        .attr('x', xPos)
        .attr('y', 80)
        .attr('text-anchor', 'left')
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .text(annotation.label);
    } else if (annotation.label === "Google released GPT chatbot Bard") {
      annotationItem.append('text')
        .attr('class', 'annotation-label')
        .attr('x', xPos)
        .attr('y', 100)
        .attr('text-anchor', 'left')
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .text(annotation.label);
    } else {      
      annotationItem.append('text')
        .attr('class', 'annotation-label')
        .attr('x', xPos)
        .attr('y', 5)
        .attr('text-anchor', 'left')
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .text(annotation.label);
    }
  });

  // ADD RECTANGLE ANNOTATION FOR COVID PERIOD
  // Using the same x scale for consistency
  const startYear = 2020.0;  // January 2020
  const endYear = 2022.99;   // December 2022
  
  const startX = xScale(startYear);
  const endX = xScale(endYear);
  const startY = y(50);  // Upper y position (50%)
  const endY = y(30);    // Lower y position (30%)

  // Add rectangle
  annotationGroup.append('rect')
    .attr('class', 'annotation-rect peak-period')
    .attr('x', startX)
    .attr('y', startY)
    .attr('width', endX - startX)
    .attr('height', endY - startY)
    .style('fill', 'rgba(255, 165, 0, 0.80)')
    .style('stroke', '#FF7039')
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
    .text('COVID-19 Pandemic');
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

// Add this method to your AIChartComponent class

/**
 * Calculate the percentage change between two specified dates for a given metric
 * @param metric The metric name to calculate change for
 * @param startDateStr Start date in YYYY-MM-DD format
 * @param endDateStr End date in YYYY-MM-DD format
 * @returns The percentage or absolute change value
 */
public getPeriodicChange(metric: string, startDateStr: string, endDateStr: string): number {
  const metricData = this.data.filter(d => d.metric === metric);
  
  // Convert string dates to Date objects
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  
  // Get start year and end year
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  
  // Find the closest data points to the specified dates
  // First priority: exact year match
  let startData = metricData.find(d => d.year === startYear);
  let endData = metricData.find(d => d.year === endYear);
  
  // Second priority: find closest available data point
  if (!startData) {
    // Find the closest year greater than or equal to startYear
    const availableYears = metricData.map(d => d.year).filter(y => y >= startYear).sort();
    if (availableYears.length > 0) {
      startData = metricData.find(d => d.year === availableYears[0]);
    }
  }
  
  if (!endData) {
    // Find the closest year less than or equal to endYear
    const availableYears = metricData.map(d => d.year).filter(y => y <= endYear).sort((a, b) => b - a);
    if (availableYears.length > 0) {
      endData = metricData.find(d => d.year === availableYears[0]);
    }
  }
  
  // If we still don't have data points, return 0
  if (!startData || !endData) {
    return 0;
  }
  
  // Calculate the change
  const startValue = startData.value;
  const endValue = endData.value;
  const absoluteChange = endValue - startValue;
  
  // Return the change in percentage points (for percentage metrics)
  // or absolute value change (for job metrics)
  return absoluteChange;
}

/**
 * Get the most recent value for a metric up to the specified date
 * @param metric The metric name
 * @param dateStr Date in YYYY-MM-DD format
 * @returns The metric value or 0 if not found
 */
public getMetricValueAtDate(metric: string, dateStr: string): number {
  const metricData = this.data.filter(d => d.metric === metric);
  
  if (metricData.length === 0) {
    return 0;
  }
  
  // Convert string date to Date object
  const targetDate = new Date(dateStr);
  const targetYear = targetDate.getFullYear();
  
  // Find the closest year less than or equal to the target year
  const availableYears = metricData
    .map(d => d.year)
    .filter(y => y <= targetYear)
    .sort((a, b) => b - a);
  
  if (availableYears.length === 0) {
    return 0;
  }
  
  const closestYear = availableYears[0];
  const dataPoint = metricData.find(d => d.year === closestYear);
  
  return dataPoint ? dataPoint.value : 0;
}
/**
   * Populate the cache with metric values for quick access
   */
  private populateMetricValueCache(): void {
    // Clear the cache first
    this.metricValueCache.clear();
    
    // Group data by metric
    this.metrics.forEach(metric => {
      const metricData = this.data.filter(d => d.metric === metric);
      const yearMap = new Map<number, number>();
      
      metricData.forEach(d => {
        // Convert string percentage values to numbers if needed
        let value = d.value;
        if (typeof value === 'string') {
          // Cast to string explicitly before using replace
          value = parseFloat((value as string).replace(/%/g, ''));
        }
        yearMap.set(d.year, value);
      });
      
      this.metricValueCache.set(metric, yearMap);
    });
  }

  /**
   * Get the value of a metric for a specific year from the cache
   * @param metric The metric name
   * @param year The year to get the value for
   * @returns The metric value or 0 if not found
   */
  private getMetricValueForYear(metric: string, year: number): number {
    const metricMap = this.metricValueCache.get(metric);
    if (!metricMap) return 0;
    
    return metricMap.get(year) || 0;
  }
  /**
   * Calculate the difference between metric values at two years
   * @param metric The metric name
   * @param startYear The starting year
   * @param endYear The ending year
   * @returns The difference between the values
   */
  public getMetricDifference(metric: string, startYear: number, endYear: number): number {
    const startValue = this.getMetricValueForYear(metric, startYear);
    const endValue = this.getMetricValueForYear(metric, endYear);
    
    return endValue - startValue;
  }
}