import { ModalService } from '@aitheon/core-client';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  OnDestroy,
} from '@angular/core';
import { SocketMetadata } from '@aitheon/system-graph';
import { IoType } from '../../../../shared/enums/io-type.enum';
import { FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { NodeWithIo } from '../../../shared/interfaces/node-with-io.interface';
import { MappingService } from '../../../shared/services/mapping-service';

@Component({
  selector: 'ai-io-selector',
  templateUrl: './io-selector.component.html',
  styleUrls: ['./io-selector.component.scss']
})
export class IoSelectorComponent implements OnInit, OnChanges, OnDestroy {
  @Input() ioType!: IoType;
  @Input() io: NodeWithIo[] = [];
  @Input() isIoHasConnection: boolean;
  @Output() ioSelected = new EventEmitter<{
    ioType: IoType,
    io: SocketMetadata,
  }>();
  @Output() ioChangeApproved = new EventEmitter<void>();

  subscriptions$ = new Subscription();
  selectedIo: SocketMetadata;
  isOpened: boolean;
  isResultsEmpty: boolean;
  searchControl: FormControl;

  constructor(
    private mappingService: MappingService,
    private modalService: ModalService,
  ) {}

  ngOnInit(): void {
    this.searchControl = new FormControl(null);
    this.onSearchValueChange();
    this.onIoSet();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.io?.currentValue) {
      this.updateIoFiltering(this.searchControl?.value);
    }
  }

  onSearchValueChange(): void {
    this.subscriptions$.add(this.searchControl.valueChanges.subscribe(value => {
      this.updateIoFiltering(value);
    }));
  }

  updateIoFiltering(value: string): void {
    let filteredIoLength = 0;
    for (const nodeWithIo of this.io) {
      nodeWithIo.filteredIo = nodeWithIo.io.filter(({ name }) => {
        if (value?.length > 1) {
          return name?.toLowerCase().includes(value.toLowerCase());
        }
        return true;
      });
      filteredIoLength += nodeWithIo.filteredIo.length;
    }
    this.isResultsEmpty = !filteredIoLength;
  }

  onIoSet(): void {
    this.subscriptions$.add(this.mappingService[`${this.ioType.toLowerCase()}Set$`].subscribe(io => {
      this.selectedIo = io;
    }));
  }

  public onIoSelect(event: Event, io: SocketMetadata): void {
    this.stopEvent(event);
    if (this.isIoHasConnection) {
      this.showConfirmationDialog(io);
    } else {
      this.select(io);
    }
  }

  private select(io: SocketMetadata): void {
    this.selectedIo = io;
    this.close();
    this.ioSelected.emit({
      ioType: this.ioType,
      io: this.selectedIo,
    });
  }

  private showConfirmationDialog(io: SocketMetadata): void {
    this.modalService.openGenericConfirm({
      text: 'Current IO has connections are you sure you want to select another IO? Existing connections will be broken',
      headlineText: 'IO has connections',
      callback: confirm => {
        if (confirm) {
          this.ioChangeApproved.emit();
          this.select(io);
        } else {
          this.close();
        }
      }
    });
  }

  public toggle(event: Event): void {
    this.stopEvent(event);

    this.isOpened = !this.isOpened;
    if (!this.isOpened) {
      this.searchControl.reset();
    }
  }

  public close(): void {
    this.isOpened = false;
    this.searchControl.reset();
  }

  public onDropdownClick(event: Event): void {
    this.stopEvent(event);
  }

  private stopEvent(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
  }

  ngOnDestroy(): void {
    if (this.subscriptions$) {
      this.subscriptions$.unsubscribe();
    }
  }
}
