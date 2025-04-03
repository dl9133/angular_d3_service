// src/app/data.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import * as Papa from 'papaparse';

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
}