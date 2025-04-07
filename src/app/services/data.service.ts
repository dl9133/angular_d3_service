// src/app/data.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import * as Papa from 'papaparse';
import * as _ from 'lodash';

interface LayoffData {
  date: string;
  total: number;
}

interface RawLayoffData {
  date: string;
  total_laid_off: number;
  [key: string]: any;  // for other fields in the CSV
}

interface GroupedData {
  [date: string]: number;
}

interface ParseResult extends Papa.ParseResult<RawLayoffData> {}


@Injectable({
  providedIn: 'root'
})
export class DataService {
  constructor(private http: HttpClient) {}

  getLayoffsData(): Observable<LayoffData[]> {
    return this.http.get('assets/layoffs.csv', { responseType: 'text' })
      .pipe(
        tap(csvText => console.log('Raw CSV:', csvText.substring(0, 200))), // Log first 200 chars
        map(csvText => {
          const parsedData: ParseResult = Papa.parse(csvText, {
            header: true,
            dynamicTyping: true
          });

          console.log('Parsed Data:', parsedData.data.slice(0, 2)); // Log first 2 rows

          const groupedData: GroupedData = {};
          
          parsedData.data.forEach((row: RawLayoffData) => {
            if (row.date && row.total_laid_off) {
              if (!groupedData[row.date]) {
                groupedData[row.date] = 0;
              }
              groupedData[row.date] += row.total_laid_off;
            }
          });

            const groupedByMonth: GroupedData = {};

            Object.entries(groupedData).forEach(([date, total]) => {
            const month = date.substring(0, 7); // Extract YYYY-MM from date
            if (!groupedByMonth[month]) {
              groupedByMonth[month] = 0;
            }
            groupedByMonth[month] += total;
            });

            const result = Object.entries(groupedByMonth)
            .map(([date, total]): LayoffData => ({ 
              date, 
              total 
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            console.log('Final processed data:', result.slice(0, 30)); // Log first 30 results
          return result;
        })
      );
  }

  async loadLayoffsData(): Promise<{ stateData: any[], allCompanies: any[] }> {
    try {
      // Load CSV file
      const csvData = await this.http.get('assets/layoffs.csv', { responseType: 'text' }).toPromise();
      
      // Parse CSV
      const parsedData = await new Promise<any[]>((resolve, reject) => {
        if (!csvData) {
          throw new Error('CSV data is undefined');
        }
        Papa.parse(csvData, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: function(results) {
            resolve(results.data);
          },
          error: function(error: any) {
            reject(error);
          }
        });
      });
      
      // Process the data
      return this.processLayoffsData(parsedData);
    } catch (error) {
      console.error('Error loading CSV file:', error);
      throw error;
    }
  }

  private processLayoffsData(rawData: any[]): { stateData: any[], allCompanies: any[] } {
    // Filter US companies and extract state info
    const usLayoffs = rawData
      .filter(row => row.country === 'United States')
      .map(row => ({
        ...row,
        state: this.getStateFromLocation(row.location)
      }))
      .filter(row => row.state !== null);
    
    // Group by state
    const stateData: { [key: string]: { 
      State: string; 
      companyCount: number; 
      totalLaidOff: number; 
      totalPercentage: number; 
      companies: { 
        'Company Name': string; 
        'Industry': string; 
        'Total Laid Off': number; 
        'Percentage': string; 
        'Date': string; 
        'Stage': string; 
        'State': string; 
      }[]; 
    } } = {};
    
    usLayoffs.forEach(company => {
      const state = company.state;
      
      if (!stateData[state]) {
        stateData[state] = {
          State: state,
          companyCount: 0,
          totalLaidOff: 0,
          totalPercentage: 0,
          companies: []
        };
      }
      
      stateData[state].companyCount += 1;
      stateData[state].totalLaidOff += company.total_laid_off || 0;
      stateData[state].totalPercentage += company.percentage_laid_off || 0;
      
      // Format company data for display
      stateData[state].companies.push({
        'Company Name': company.company || 'Unknown',
        'Industry': company.industry || 'Unknown',
        'Total Laid Off': company.total_laid_off || 0,
        'Percentage': company.percentage_laid_off ? (company.percentage_laid_off * 100).toFixed(1) + '%' : 'Unknown',
        'Date': company.date || 'Unknown',
        'Stage': company.stage || 'Unknown',
        'State': state
      });
    });
    
    // Calculate averages and finalize the data
    const formattedData = Object.values(stateData).map(state => ({
      ...state,
      avgPercentage: state.companyCount > 0 ? state.totalPercentage / state.companyCount : 0
    }));
    
    // Extract all companies for the panel
    const allCompanies = formattedData.flatMap(state => state.companies);
    
    return {
      stateData: formattedData,
      allCompanies: allCompanies
    };
  }

  private getStateFromLocation(location: string): string | null {
    if (!location) return null;
    
    // Create a comprehensive mapping of cities/regions to states
    const cityToState: {[key: string]: string} = {
      // California
      'San Francisco': 'California', 'SF': 'California', 'SF Bay Area': 'California', 
      'Bay Area': 'California', 'Silicon Valley': 'California', 'Los Angeles': 'California', 
      'LA': 'California', 'San Diego': 'California', 'Sacramento': 'California',
      'Oakland': 'California', 'Palo Alto': 'California', 'San Jose': 'California',
      'Mountain View': 'California', 'Menlo Park': 'California', 'Sunnyvale': 'California',
      'Santa Clara': 'California', 'Irvine': 'California', 'Redwood City': 'California',
      'Santa Monica': 'California', 'San Mateo': 'California', 'Berkeley': 'California',
      
      // New York
      'New York': 'New York', 'NYC': 'New York', 'New York City': 'New York',
      'Brooklyn': 'New York', 'Manhattan': 'New York',
      
      // Washington
      'Seattle': 'Washington', 'Redmond': 'Washington', 'Bellevue': 'Washington',
      
      // Texas
      'Austin': 'Texas', 'Dallas': 'Texas', 'Houston': 'Texas', 
      'San Antonio': 'Texas', 'Fort Worth': 'Texas',
      
      // Illinois
      'Chicago': 'Illinois',
      
      // Massachusetts
      'Boston': 'Massachusetts', 'Cambridge': 'Massachusetts',
      
      // Pennsylvania
      'Philadelphia': 'Pennsylvania', 'Pittsburgh': 'Pennsylvania',
      
      // Florida
      'Miami': 'Florida', 'Orlando': 'Florida', 'Tampa': 'Florida',
      
      // More states
      'Denver': 'Colorado', 'Boulder': 'Colorado',
      'Atlanta': 'Georgia', 'Portland': 'Oregon',
      'Salt Lake City': 'Utah', 'Phoenix': 'Arizona',
      'Nashville': 'Tennessee', 'Las Vegas': 'Nevada',
      'Minneapolis': 'Minnesota', 'Detroit': 'Michigan',
      'Columbus': 'Ohio', 'Cincinnati': 'Ohio', 'Cleveland': 'Ohio',
      'Indianapolis': 'Indiana', 'Charlotte': 'North Carolina',
      'Raleigh': 'North Carolina', 'Durham': 'North Carolina',
      'Washington DC': 'District of Columbia', 'DC': 'District of Columbia',
      'Madison': 'Wisconsin', 'Milwaukee': 'Wisconsin',
      'St. Louis': 'Missouri', 'Kansas City': 'Missouri'
    };
    
    // Try direct city match
    const city = location.trim();
    if (cityToState[city]) {
      return cityToState[city];
    }
    
    // Try to match city within the location string
    for (const [city, state] of Object.entries(cityToState)) {
      if (location.includes(city)) {
        return state;
      }
    }
    
    // If we have a state code, try to match that
    const stateAbbreviations: {[key: string]: string} = {
      'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
      'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
      'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
      'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
      'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
      'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
      'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
      'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
      'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
      'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
      'DC': 'District of Columbia'
    };
    
    // Look for state abbreviation pattern
    const stateCodeMatch = location.match(/\b([A-Z]{2})\b/);
    if (stateCodeMatch && stateAbbreviations[stateCodeMatch[1]]) {
      return stateAbbreviations[stateCodeMatch[1]];
    }
    
    return null;
  }
}