export class NavigationMenuItem {
  constructor(
    public title: string,
    public routerLink: string,
    public permissions: string,
    public disabled?: boolean,
  ) {}
}
