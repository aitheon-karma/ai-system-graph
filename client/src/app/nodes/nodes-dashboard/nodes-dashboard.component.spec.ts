import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CoreNodesDashboardComponent } from './nodes-dashboard.component';

describe('NodesDashboardComponent', () => {
  let component: CoreNodesDashboardComponent;
  let fixture: ComponentFixture<CoreNodesDashboardComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CoreNodesDashboardComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CoreNodesDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
