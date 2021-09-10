import { CoreClientModule } from '@aitheon/core-client';
import { ItemManagerModule } from '@aitheon/item-manager';
import { TemplateModule as OrchestratorModule } from '@aitheon/orchestrator';
import { TemplateModule as PlatformSupportModule } from '@aitheon/platform-support';
import { SmartInfrastructureModule } from '@aitheon/smart-infrastructure';
import { MarketplaceModule } from '@aitheon/marketplace';
import { Configuration, ConfigurationParameters, SystemGraphModule } from '@aitheon/system-graph';

import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { environment } from '../environments/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { NavigationMenuComponent } from './shared/components/navigation-menu/navigation-menu.component';
import { CreatorsStudioModule } from '@aitheon/creators-studio';
import { SharedModule } from './shared/shared.module';

export function apiConfigFactory(): Configuration {
  const params: ConfigurationParameters = {
    basePath: '.'
  };
  return new Configuration(params);
}

export function apiOrchestratorConfigFactory(): Configuration {
  const params: ConfigurationParameters = {
    basePath: `${environment.production ? '' : environment.baseApi}/orchestrator`
  };
  return new Configuration(params);
}

export function apiItemManagerConfigFactory(): Configuration {
  const params: ConfigurationParameters = {
    basePath: `${environment.production ? '' : environment.baseApi}/item-manager`
  };
  return new Configuration(params);
}

export function apiPlatformSupportConfigFactory(): Configuration {
  const params: ConfigurationParameters = {
    basePath: `${environment.production ? '' : environment.baseApi}/platform-support`
  };
  return new Configuration(params);
}

export function apiSmartInfrastructureConfigFactory(): Configuration {
  const params: ConfigurationParameters = {
    basePath: `${environment.production ? '' : environment.baseApi}/smart-infrastructure`
  };
  return new Configuration(params);
}

export function apiMarketplaceConfigFactory(): Configuration {
  const params: ConfigurationParameters = {
    basePath: `${environment.production ? '' : environment.baseApi}/marketplace`
  };
  return new Configuration(params);
}

export function apiCreatorsConfigFactory(): Configuration {
  const params: ConfigurationParameters = {
    basePath: `${environment.production ? '' : environment.baseApi}/creators-studio`
  };
  return new Configuration(params);
}

@NgModule({
  declarations: [
    AppComponent,
    NavigationMenuComponent,
  ],
  imports: [
    CoreClientModule.forRoot({
      baseApi: environment.baseApi,
      production: environment.production
    }),
    AppRoutingModule,
    BrowserAnimationsModule,
    SystemGraphModule.forRoot(apiConfigFactory),
    ItemManagerModule.forRoot(apiItemManagerConfigFactory),
    PlatformSupportModule.forRoot(apiPlatformSupportConfigFactory),
    SmartInfrastructureModule.forRoot(apiSmartInfrastructureConfigFactory),
    OrchestratorModule.forRoot(apiOrchestratorConfigFactory),
    MarketplaceModule.forRoot(apiMarketplaceConfigFactory),
    CreatorsStudioModule.forRoot(apiCreatorsConfigFactory),
    SharedModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
