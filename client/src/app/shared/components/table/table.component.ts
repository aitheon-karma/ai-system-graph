import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TableColumn } from '../../interfaces/table-column.interface';

import { sortBy } from 'lodash';

@Component({
  selector: 'ai-table',
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableComponent implements OnInit, OnChanges, OnDestroy {

  @Input() title = '';
  @Input() collection: any[];
  @Input() columns: TableColumn[] = [];
  @Input() loading: boolean;
  @Input() searchBy: string;
  @Input() disableRowClick = false;
  @Input() hideFooter: boolean;
  @Input() disablePagination: boolean;
  @Input() paginationConfig: number[] = [10, 25, 50];
  @Output() rowClicked = new EventEmitter<object>();

  rowsCount: number;
  initialRows = 10;
  currentPage = 1;
  searchForm: FormGroup;
  formSubscription: Subscription;
  filteredCollection: any;
  pages: any;
  ordering: string;
  sortBy: string;

  ngOnInit(): void {
    this.searchForm = new FormGroup({
      search: new FormControl(null, Validators.required),
    });
    this.rowsCount = this.initialRows = this.paginationConfig[0];
    this.onSearchChanges();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const collection = <any>changes.collection;
    if (collection && collection.currentValue) {
      this.ordering = null;
      this.sortBy = null;
      this.filteredCollection = [...this.collection];
      this.createPages();
    }
  }

  createPages() {
    if (!this.disablePagination) {
      this.pages = this.chunkArray(this.filteredCollection, this.rowsCount);
      this.currentPage = 1;
    }
  }

  chunkArray(collection: any, chunkSize: number) {
    const result = [];
    for (let i = 0; i < collection.length; i += chunkSize) {
      result.push(collection.slice(i, i + chunkSize));
    }
    return result;
  }

  onSearchChanges() {
    this.formSubscription = this.searchForm.valueChanges
      .subscribe(value => {
        this.filterCollection(value.search);
      });
  }

  filterCollection(search: string) {
    if (!search) {
      this.filteredCollection = [...this.collection];
      this.createPages();
      return;
    }
    this.filteredCollection = [...this.collection]
      .filter(({ [this.searchBy]: item = '' }) => {
        if (item) {
          return item.toLowerCase().includes(search.toLowerCase());
        }
        return true;
      });
    this.createPages();
  }

  getColWidth(width: number = 1) {
    const colWidth = `col-${width}`;
    return { [colWidth]: true };
  }

  onRowClick(row: object, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.disableRowClick) {
      this.rowClicked.emit(row);
    }
  }

  onStartSort(colKey: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    if ((!this.ordering && !this.sortBy) || colKey !== this.sortBy) {
      this.ordering = 'ASC';
      this.sortBy = colKey;
      this.sortCollection();
      return;
    }
    if (colKey === this.sortBy && this.ordering === 'ASC') {
      this.ordering = 'DESC';
      this.sortCollection();
      return;
    }
    if (colKey === this.sortBy && this.ordering === 'DESC') {
      this.ordering = null;
      this.sortBy = null;
      this.filterCollection(this.searchForm.value.search);
      return;
    }
  }

  sortCollection() {
    const sorted = sortBy([...this.filteredCollection], this.sortBy);
    if (this.ordering === 'DESC') {
      this.filteredCollection = sorted.reverse();
    } else {
      this.filteredCollection = sorted;
    }
    this.createPages();
  }

  sortFunc(a, b) {
    const prevItem = a[this.sortBy];
    const nexItem = b[this.sortBy];
    const prepare = value => value.toString().toLowerCase();
    if (typeof prevItem === 'number' && typeof nexItem === 'number') {
      if (prevItem < nexItem) {
        return -1;
      }
      if (prevItem > nexItem) {
        return 1;
      }
      return 0;
    }
    if (prepare(prevItem) < prepare(nexItem)) {
      return -1;
    }
    if (prepare(prevItem) > prepare(nexItem)) {
      return 1;
    }
    return 0;
  }

  pageChanged(pageObj: { page: number }) {
    this.currentPage = pageObj.page;
  }

  changeRowsCount(rowsCount: number) {
    this.rowsCount = rowsCount;
    this.createPages();
  }

  trackByFn(index, item) {
    if (item) {
      return item.key || item.label;
    }
    return index;
  }

  trackByIndex(index) {
    return index;
  }

  toggleSelected(i: number) {
    this.filteredCollection = this.filteredCollection.map((item, index) => ({
      ...item,
      selected: i === index ? !item.selected : false,
    }));
  }

  ngOnDestroy(): void {
    try {
      this.formSubscription.unsubscribe();
    } catch {}
  }
}
