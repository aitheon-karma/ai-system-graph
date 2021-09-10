import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ReleasesModalComponent } from './releases-modal.component';

describe('ReleasesModalComponent', () => {
  let component: ReleasesModalComponent;
  let fixture: ComponentFixture<ReleasesModalComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ReleasesModalComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ReleasesModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
