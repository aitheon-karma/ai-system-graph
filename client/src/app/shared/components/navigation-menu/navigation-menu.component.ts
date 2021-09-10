import { AuthService } from '@aitheon/core-client';
import { Component, OnInit } from '@angular/core';
import { NavigationMenuItem } from '../../models/navigation-menu-item.model';

@Component({
  selector: 'ai-navigation-menu',
  templateUrl: './navigation-menu.component.html',
  styleUrls: ['./navigation-menu.component.scss']
})
export class NavigationMenuComponent implements OnInit {
  constructor(
    private authService: AuthService,
  ) {}

  isSysAdmin = false;
  hasSocketsAccess = false;
  menuData: NavigationMenuItem[] = [
    new NavigationMenuItem(
      'Graphs',
      '/graphs/organization',
      'all',
    ),
    new NavigationMenuItem(
      'Sockets',
      'admin/sockets',
      'socketsAdmin'
    ),
    new NavigationMenuItem(
      'Core Nodes',
      'admin/nodes',
      'sysadmin'
    ),
  ];

  ngOnInit(): void {
    this.authService.currentUser.subscribe((user: any) => {
      this.isSysAdmin = user.sysadmin;
      this.hasSocketsAccess = user.hasSocketsAccess || user.sysadmin;
    });
  }

}
