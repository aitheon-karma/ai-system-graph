import { AuthService } from '@aitheon/core-client';
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class OrganizationsService implements OnDestroy {
  private subscriptions$ = new Subscription();
  private _currentOrganization$ = new BehaviorSubject<any>(null);
  private _organization: any;

  constructor(
    private authService: AuthService,
  ) {
    this.subscriptions$.add(this.authService.activeOrganization.subscribe(organization => {
      this._organization = organization;
      this._currentOrganization$.next(organization);
    }));
  }

  public get currentOrganization$(): Observable<any> {
    return this._currentOrganization$.asObservable().pipe(filter(org => !!org));
  }

  public setHeaders(service: any): void {
    service.defaultHeaders = service
      .defaultHeaders.set('organization-id', this._organization._id);
  }

  ngOnDestroy(): void {
    try {
      this.subscriptions$.unsubscribe();
    } catch (e) {}
  }
}
