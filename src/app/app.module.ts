import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule, DecimalPipe } from '@angular/common';

import { AppComponent } from './app.component';
import { LayoffsMapComponent } from './layoffs-map/layoffs-map.component';

@NgModule({
  declarations: [
    AppComponent,
    LayoffsMapComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    CommonModule
  ],
  providers: [DecimalPipe],
  bootstrap: [AppComponent]
})
export class AppModule { }