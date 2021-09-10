import { AuthService } from '@aitheon/core-client';
import { Infrastructure, InfrastructureRestService } from '@aitheon/smart-infrastructure';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { DevicesService } from '../shared/services/devices.service';

@Component({
  selector: 'ai-service-items',
  templateUrl: './service-items.component.html',
  styleUrls: ['./service-items.component.scss'],
})
export class ServiceItemsComponent implements OnInit {

  loading = true;
  serviceId: string;
  serviceItems: any;
  type: any;
  items: any[];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private infrastructureRestService: InfrastructureRestService,
    private authService: AuthService,
    private devicesService: DevicesService,
  ) {}

  ngOnInit(): void {
    this.serviceId = this.route.snapshot.paramMap.get('serviceId');
    this.type = this.route.snapshot.queryParamMap.get('type');
    this.authService.activeOrganization.subscribe((org: any) => {

      if (this.serviceId) {

        switch (this.serviceId) {
          case 'SMART_INFRASTRUCTURE':
            this.getInfrastructureItems(org);
            break;

          case 'DEVICE_MANAGER':
            this.getDeviceItems(org);
            break;
        }

        this.loading = false;
      }
    });

  }

  onItemClick(event: Event, itemId: string) {
    event.stopPropagation();
    event.preventDefault();

    this.router.navigate(['/graphs', 'organization', 'service', this.serviceId], {
      queryParams: { itemId },
    });
  }

  getInfrastructureItems(org: any) {

    if (!environment.production && org) {
      this.infrastructureRestService.defaultHeaders = this.infrastructureRestService.defaultHeaders.set('organization-id', org._id);
    }

    this.infrastructureRestService.list().subscribe((items: Infrastructure[]) => {
      this.serviceItems = items.filter((item: Infrastructure) => {
        return item.type === this.type;
      });
    });
  }

  getDeviceItems(org: any) {

    if (!environment.production && org) {
      this.infrastructureRestService.defaultHeaders = this.infrastructureRestService.defaultHeaders.set('organization-id', org._id);
    }

    this.devicesService.list().subscribe((devices: any) => {
      this.serviceItems = devices;
    });

  }
}
