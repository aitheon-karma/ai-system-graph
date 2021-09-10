import { Graph } from '@aitheon/system-graph';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges, } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';

import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { GraphsService } from '../graphs.service';

@Component({
  selector: 'ai-subgraph-form',
  templateUrl: './subgraph-form.component.html',
  styleUrls: ['./subgraph-form.component.scss']
})
export class SubgraphFormComponent implements OnChanges, OnDestroy {
  @Input() submitted: boolean;
  @Input() graph: Graph;

  readonly dropdownClearable = false;
  readonly runtimes = [
    { label: 'AOS', value: 'AOS' },
    { label: 'AOS Embedded', value: 'AOS_EMBEDDED' },
    { label: 'AOS Cloud', value: 'AOS_CLOUD' },
  ];
  subgraphForm: FormGroup;
  formSubscription: Subscription;

  constructor(
    private fb: FormBuilder,
    private graphsService: GraphsService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.subgraphForm) {
      this.initForm(changes.graph.currentValue);
    }
  }

  initForm(graph: Graph) {
    this.subgraphForm = this.fb.group({
      name: [graph ? graph.name : null, Validators.required],
      runtime: [graph ? graph.runtime : null, Validators.required],
    });

    this.formSubscription = this.subgraphForm.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
    ).subscribe(value => {
      this.graphsService.onGraphTemplateFormChange(value);
    });
  }

  get nameControl() {
    return this.subgraphForm.get('name') as FormControl;
  }

  get runtimeControl() {
    return this.subgraphForm.get('runtime') as FormControl;
  }

  ngOnDestroy(): void {
    if (this.formSubscription) {
      try {
        this.formSubscription.unsubscribe();
      } catch {}
    }

    this.subgraphForm = null;
    this.graph = null;
  }
}
