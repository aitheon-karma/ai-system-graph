import { AuthService } from '@aitheon/core-client';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'ai-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.authService.loggedIn.subscribe((loggedIn: boolean) => {
      console.log('loggedIn ', loggedIn);

      // prevent access by url to graph
      // if (this.router.url === '/' && environment.production) {
      //   window.location.href = '/users/dashboard';
      // }
    });
  }

}
