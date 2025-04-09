import { Component, OnInit, ViewEncapsulation, AfterViewInit, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as d3 from 'd3';
//import * as topojson from 'topojson-client';
import * as _ from 'lodash';
import tinycolor from 'tinycolor2';
import { DataService } from '../services/data.service';

@Component({
  selector: 'app-layoffs-map',
  templateUrl: './layoffs-map.component.html',
  styleUrls: ['./layoffs-map.component.css'],
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, FormsModule]  // Make sure CommonModule is here
})
export class LayoffsMapComponent implements OnInit, AfterViewInit {
  // Data properties
  public stateData: any[] = [];
  public allCompanies: any[] = [];
  public currentCompanies: any[] = [];
  public currentState: string | null = null;
  public searchText: string = '';
  public isLoading: boolean = true;
  public stats = {
    totalCompanies: 0,
    totalLayoffs: 0,
    statesAffected: 0
  };
  public selectedMetric: string = 'companyCount';

  // D3 visualization properties
  private svg: any;
  private path: any;
  private tooltip: any;
  private width: number = 800;
  private height: number = 500;

  constructor(
    private http: HttpClient, 
    private dataService: DataService,
    private el: ElementRef
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    // Map will be initialized after data is loaded
  }

  async loadData(): Promise<void> {
    try {
      this.isLoading = true;
      const { stateData, allCompanies } = await this.dataService.loadLayoffsData();
      this.stateData = stateData;
      this.allCompanies = allCompanies;
      this.currentCompanies = allCompanies;
      
      // Update statistics
      this.stats = {
        totalCompanies: allCompanies.filter(company => company['Total Laid Off'] > 0).length,
        totalLayoffs: this.stateData.reduce((sum, state) => sum + state.totalLaidOff, 0),
        statesAffected: this.stateData.length
      };

      this.isLoading = false;
      
      // Initialize map after data is loaded
      setTimeout(() => {
        this.initializeMap();
      }, 0);
    } catch (error) {
      console.error('Error loading data:', error);
      this.isLoading = false;
    }
  }

  onMetricChange(event: Event): void {
    this.selectedMetric = (event.target as HTMLSelectElement).value;
    this.updateVisualization();
  }

  filterCompanies(): void {
    if (!this.searchText) {
      this.currentCompanies = this.currentState ? 
        this.stateData.find(state => state.State === this.currentState)?.companies || [] : 
        this.allCompanies;
    } else {
      const search = this.searchText.toLowerCase();
      const companies = this.currentState ? 
        this.stateData.find(state => state.State === this.currentState)?.companies || [] : 
        this.allCompanies;
      
      this.currentCompanies = companies.filter((company: { [x: string]: string; }) => 
        (company['Company Name'] && company['Company Name'].toLowerCase().includes(search)) ||
        (company['Industry'] && company['Industry'].toLowerCase().includes(search)) ||
        (company['State'] && company['State'].toLowerCase().includes(search))
      );
    }
  }

  resetSearch(): void {
    this.searchText = '';
    this.currentState = null;
    this.currentCompanies = this.allCompanies;
  }

  // D3 map visualization methods
  private initializeMap(): void {
    // Remove any existing SVG
    d3.select('.home svg').remove();
    
    // Calculate dimensions based on container width
    const container = this.el.nativeElement.querySelector('.map-container');
    if (!container) return;
    
    const containerWidth = container.getBoundingClientRect().width;
    this.width = Math.min(containerWidth, 800);
    this.height = this.width * 0.6;
    
    // Create SVG
    this.svg = d3.select('.home')
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height);
    
    // Create projection
    const projection = d3.geoAlbersUsa()
    .translate([this.width / 2, this.height / 2])
    .scale(800); // Use a fixed value initially for testing
    
    this.path = d3.geoPath().projection(projection);
    
    // Create tooltip
    this.tooltip = d3.select('.home')
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);
    
    // Draw initial map
    this.updateVisualization();
    
    // Add window resize listener
    window.addEventListener('resize', _.debounce(() => {
      this.initializeMap();
    }, 250));
  }

  private updateVisualization(): void {
    // Check if SVG is initialized
    if (!this.svg) return;
    
    // Clear existing map
    this.svg.selectAll('*').remove();
    d3.select('.legend').remove();
    
    // Get values for chosen metric
    let values = this.stateData.map(d => d[this.selectedMetric]).filter(v => v !== undefined && v !== null);
    values.sort((a, b) => a - b);
    
    let domain = this.selectDivisionNumber(values).sort((a, b) => a - b);
    
    // Create color scale based on the metric
    let colorScheme;
    if (this.selectedMetric === 'companyCount') {
      colorScheme = ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"];
    } else if (this.selectedMetric === 'totalLaidOff') {
      colorScheme = ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"];
    } else if (this.selectedMetric === 'avgPercentage') {
      colorScheme = ["#fee5d9", "#fcbba1", "#fc9272", "#fb6a4a", "#de2d26"];
    }
    
    // Create appropriate color scale
    const colorScale = d3.scaleLinear<string>()
      .domain(domain)
      .range(colorScheme as string[]);
    
    // Load US map
    this.http.get('https://gist.githubusercontent.com/Bradleykingz/3aa5206b6819a3c38b5d73cb814ed470/raw/a476b9098ba0244718b496697c5b350460d32f99/us-states.json').subscribe((usStates: any) => {
      //console.log('GeoJSON state names:', usStates.features.map((s: { properties: { name: any; }; }) => s.properties.name));
      //console.log('Your data state names:', this.stateData.map(s => s.State));
      if (!usStates || !usStates.features || !Array.isArray(usStates.features)) {
        console.error('Invalid US states GeoJSON format:', usStates);
        return;
      }
      
      //console.log('Number of states in GeoJSON:', usStates.features.length);
      // Merge state data with map data
      const mergedData = _.map(usStates.features, (feature: any) => {
        const stateName = feature.properties.name;
        const stateData = _.find(this.stateData, { 'State': stateName });
        //console.log(`Merging state ${stateName}, found data:`, stateData);

        return {
          ...feature,
          ...stateData
        };
      });
      
      // Draw states
      this.svg.selectAll('.state')
        .data(mergedData)
        .enter()
        .append('path')
        .attr("d", this.path)
        .style('transition', "all 0.2s ease-in-out")
        .attr('class', 'state')
        .style('fill', (d: any) => {
          const value = d[this.selectedMetric];
          if (value) {
            return colorScale(value);  // Use your data color
          } else if (d.properties && d.properties.name) {
            return '#eee';  // Light gray for states without data
          } else {
            return 'red';  // Red highlight for debugging purposes
          }
        })
        .on('mousemove', (event: any, d: any) => {
          if (!d[this.selectedMetric]) return;
          
          this.tooltip.transition()
            .duration(500)
            .style("opacity", .9);
          
          let tooltipContent = `<strong>${d.properties.name}</strong><br>`;
          
          switch(this.selectedMetric) {
            case 'companyCount':
              //console.log('Children of d element:', d);
              // Use d.companies which should be the array of companies
              const companies = d.companies || [];
              tooltipContent += `${companies.filter((company: { [key: string]: any }) => company['Total Laid Off'] > 0).length} companies with layoffs`;
              break;
            case 'totalLaidOff':
              tooltipContent += `${d.totalLaidOff.toLocaleString()} employees laid off`;
              break;
            case 'avgPercentage':
              tooltipContent += `Avg layoff: ${(d.avgPercentage * 100).toFixed(1)}% of workforce`;
              break;
          }
          
          this.tooltip.html(tooltipContent)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseover", (event: any, d: any) => {
          if (!d[this.selectedMetric]) return;
          
          d3.select(event.currentTarget)
            .style("fill", tinycolor(colorScale(d[this.selectedMetric])).darken(15).toString())
            .style("cursor", "pointer");
          
          // Update the panel to show companies for this state
          // if (d.companies && d.companies.length > 0) {
          //   this.searchText = '';
          //   this.currentState = d.properties.name;
          //   this.currentCompanies = d.companies;
          // }
        })
        .on("mouseout", (event: any, d: any) => {
          d3.select(event.currentTarget).style("fill", () => {
            const value = d[this.selectedMetric];
            return value ? colorScale(value) : "#eee";
          });
          
          this.tooltip.transition()
            .duration(200)
            .style("opacity", 0);
        })
        .on("click", (event: any, d: any) => {
          if (!d.companies || d.companies.length === 0) return;
    
          // Clear the search input
          this.searchText = '';
          
          // Update the state and companies
          this.currentState = d.properties.name;
          this.currentCompanies = d.companies;
          
          // Highlight the selected state
          this.svg.selectAll('.state')
            .style('stroke-width', function(s: any) {
              return s === d ? 2 : 1;
            })
            .style('stroke', function(s: any) {
              return s === d ? '#333' : '#ffffff';
            });
        });
      
      // Create legend
      this.createLegend(colorScale, domain);
    });
  }

  private createLegend(colorScale: any, domain: number[]): void {
    const legend = d3.select('.home')
      .append('svg')
      .attr('class', 'legend')
      .attr('width', 180)
      .attr('height', 165)
      .append('g')
      .attr('transform', 'translate(10,20)');
    
    // Create legend title
    legend.append('text')
      .attr('class', 'legend-title')
      .attr('x', 0)
      .attr('y', -5)
      .style('font-weight', 'bold')
      .text(this.getMetricLabel(this.selectedMetric));
    
    // Create legend items
    const legendItems = legend.selectAll('.legend-item')
      .data(colorScale.domain().slice().reverse())
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d: any, i: number) => `translate(0, ${i * 25})`);
    
    legendItems.append('rect')
      .attr('width', 18)
      .attr('height', 18)
      .style('fill', (d: any) => colorScale(d));
    
    legendItems.append('text')
      .attr('x', 24)
      .attr('y', 9)
      .attr('dy', '.35em')
      .text((d: any) => this.formatLegendValue(d, this.selectedMetric));
  }

  private selectDivisionNumber(array: number[]): number[] {
    if (array.length === 0) return [0, 0, 0, 0];
    
    // Sort and get min, max, and quartiles for more even distribution
    array = array.sort((a, b) => a - b);
    const min = array[0];
    const max = array[array.length - 1];
    const q1Index = Math.floor(array.length * 0.25);
    const q3Index = Math.floor(array.length * 0.75);
    
    return [min, array[q1Index], array[Math.floor(array.length * 0.5)], array[q3Index], max];
  }

  private getMetricLabel(metricKey: string): string {
    const labels: {[key: string]: string} = {
      'companyCount': 'Companies with Layoffs',
      'totalLaidOff': 'Total Employees Laid Off',
      'avgPercentage': 'Avg Layoff Percentage'
    };
    return labels[metricKey] || metricKey;
  }

  private formatLegendValue(value: number, metricType: string): string {
    switch(metricType) {
      case 'companyCount':
        return value.toFixed(0);
      case 'totalLaidOff':
        return value >= 1000 ? (value/1000).toFixed(0) + 'K' : value.toString();
      case 'avgPercentage':
        return (value * 100).toFixed(1) + '%';
      default:
        return value.toFixed(1);
    }
  }

  onSearchInput(event: Event): void {
    this.searchText = (event.target as HTMLInputElement).value;
    this.filterCompanies();
  }

  formatNumber(value: number): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '0';
    }
    return value.toLocaleString();
  }
  // In your LayoffsMapComponent class
  get filteredCompanies(): any[] {
    return this.currentCompanies.filter(company => company['Total Laid Off'] > 0);
  }

  limitCompanies(companies: any[], limit: number = 200): any[] {
      // First create a copy of the array to avoid modifying the original
      const sortedCompanies = [...companies].sort((a, b) => {
        // Parse dates - assuming format is YYYY-MM-DD
        const dateA = a['Date'] ? new Date(a['Date']) : new Date(0);
        const dateB = b['Date'] ? new Date(b['Date']) : new Date(0);
        
        // Sort descending (newest first)
        return dateB.getTime() - dateA.getTime();
      });
      
      // Then slice to limit the number of companies
      return sortedCompanies.slice(0, limit);
  }
  
}