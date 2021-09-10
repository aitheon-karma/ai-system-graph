import { AuthService } from '@aitheon/core-client';
import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { hasGraphAccess, Accesses } from '../accesses';

@Injectable()
// tslint:disable-next-line:class-name
export class isAdminGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
  }

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> | Promise<boolean> | boolean {
    const role = route.data.role as Accesses;
    return this.getAccess(role);
  }

  getAccess(role: Accesses) {
    return this.authService.currentUser.pipe(map((user: any) => {
      const hasAccess = role ? hasGraphAccess(user, role) : user.sysadmin;
      if (hasAccess) {
        return true;
      } else {
        this.router.navigateByUrl(`graphs`);
        return false;
      }
    }));
  }
}
