import { Component, OnInit, OnChanges, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { range } from 'lodash';

@Component({
  selector: 'ai-pagination',
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss']
})
export class PaginationComponent implements OnInit, OnChanges, OnDestroy {

  @Input() pageSize = 1;
  @Input() total = 1;
  @Input() range = 3;
  @Input() currentPage: number;
  @Input() paginationConfig: number[] = [10, 25, 50];
  @Output() pageChange: EventEmitter<{ page: number }> = new EventEmitter<{ page: number }>();
  @Output() pageSizeChange: EventEmitter<number> = new EventEmitter<number>();
  @Output() totalPagesCount: EventEmitter<number> = new EventEmitter<number>();

  rowsCountSubscription: Subscription;
  pages: any;
  maxSize = 3;
  totalPages: number;
  clearable = false;
  searchable = false;
  rowsCount: FormControl;
  pageSizes: { value: number, label: string }[];

  get offset(): number {
    return this.currentPage * this.pageSize;
  }

  ngOnInit() {
    this.getPages(this.offset, this.pageSize, this.total);
    this.totalPagesCount.emit(this.totalPages);
    this.setPaginationProperties();
    this.initRowsSwitchControl();
  }

  ngOnChanges() {
    this.getPages(this.offset, this.pageSize, this.total);
    this.totalPagesCount.emit(this.totalPages);
  }

  setPaginationProperties() {
    this.pageSizes = this.paginationConfig.map(item => ({
      value: item,
      label: item.toString(),
    }))
  }

  initRowsSwitchControl() {
    this.rowsCount = new FormControl(this.pageSizes[0]);
    this.rowsCountSubscription = this.rowsCount.valueChanges
      .subscribe((value: { value: number, label: string }) => {
        this.pageSizeChange.emit(value.value);
      })
  }

  getPages(offset: number, pageSize: number, total: number) {
    this.totalPages = this.getTotalPages(pageSize, total);
    this.pages = range(-this.range, this.range * 2 + 1)
      .map(o => this.currentPage + o)
      .filter(page => this.isValidPageNumber(page, this.totalPages));
  }

  isValidPageNumber(page: any, totalPages: number): boolean {
    return page > 0 && page <= totalPages;
  }

  getCurrentPage(offset: number, limit: number): number {
    return Math.floor(offset / limit) + 1;
  }

  getTotalPages(pageSize: number, total: number): number {
    return Math.ceil(Math.max(total, 1) / Math.max(pageSize, 1));
  }

  selectPage(page: number, event) {
    this.cancelEvent(event);
    if (this.isValidPageNumber(page, this.totalPages)) {
      this.currentPage = page;
      this.pageChange.emit({ page: page });
      this.getPages(this.offset, this.pageSize, this.total);
    }
  }

  cancelEvent(event) {
    event.preventDefault();
  }

  ngOnDestroy(): void {
    try {
      this.rowsCountSubscription.unsubscribe();
    } catch (e) {}
  }
}
