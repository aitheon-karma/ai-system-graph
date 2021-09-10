import { FunctionalNode } from '@aitheon/system-graph';
import { ToastrService } from 'ngx-toastr';
import {
  Component,
  Output,
  ViewChild,
  EventEmitter,
  OnDestroy,
  TemplateRef,
} from '@angular/core';
import { PricingType } from '../../../shared/interfaces/pricing-type.interface';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DriveUploaderComponent, AuthService } from '@aitheon/core-client';
import { FileItem } from '@aitheon/creators-studio';
import { CategoriesRestService, StoreRequestsRestService } from '@aitheon/marketplace';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { environment } from '../../../../environments/environment';
import { Subscription } from 'rxjs';
import { SharedService } from '../../../shared/services/shared.service';
import { StoreRequestForm } from '../../../shared/interfaces/store-requst-form.interface';

class StoreRequest extends StoreRequestForm {
  initial: StoreRequestForm;
}

enum Tab {
  INFORMATION = 'INFORMATION',
  CUSTOMIZATION = 'CUSTOMIZATION',
}

@Component({
  selector: 'ai-store-request-modal',
  templateUrl: './store-request-modal.component.html',
  styleUrls: ['./store-request-modal.component.scss']
})
export class StoreRequestModalComponent implements OnDestroy {
  @ViewChild('driveUploader') driveUploader: DriveUploaderComponent;
  @Output() close: EventEmitter<boolean> = new EventEmitter<boolean>();
  @ViewChild('settingsProjectModal') settingsProjectModal: TemplateRef<any>;

  saveCallback: any;
  submitted: boolean;
  tabs: {
    label: string,
    key: Tab.INFORMATION | Tab.CUSTOMIZATION,
  }[];
  tabTypes = Tab;
  activeTab: Tab.INFORMATION | Tab.CUSTOMIZATION = Tab.INFORMATION;
  itemImageFile: FileItem = new FileItem();
  itemImageFiles: FileItem[] = [];
  itemImages: any = [];
  imageLoading = false;
  itemAvatarImageFile: FileItem;
  itemLogoImageFile: FileItem;
  imageAvatarLoading = false;
  imageLogoLoading = false;
  pricingType = PricingType;
  categories: any[] = [];
  currentOrganization: any;
  serviceKey = {
    _id: 'HR',
    key: ``
  };
  appStoreForm: FormGroup;
  nodeStylingForm: FormGroup;
  settingsProjectModalRef: BsModalRef;
  node = {
    inputs: [],
    outputs: [],
    type: 'TEMPLATE_NODE',
  } as any;
  loading = false;
  subscriptions: Subscription[] = [];
  disabled: boolean;
  storeRequest: StoreRequest;
  viewedTabs = [] as string[];

  allowedMimeType = [
    'image/jpeg',
    'image/png',
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private categoriesRestService: CategoriesRestService,
    private modalService: BsModalService,
    private toastrService: ToastrService,
    private sharedService: SharedService,
    private storeRequestsRestService: StoreRequestsRestService,
  ) {
    this.authService.activeOrganization.subscribe((org: any) => {
      this.currentOrganization = org;
      if (!environment.production) {
        this.storeRequestsRestService.defaultHeaders = this.storeRequestsRestService
          .defaultHeaders.set('organization-id', org._id);
      }
      this.serviceKey = {
        _id: 'HR',
        key: this.currentOrganization ? `${this.currentOrganization._id}` : 'PERSONAL'
      };
    });
  }

  private buildMarketplaceRequestForm() {
    const { titleImage, name, urlName, description, pricingType, price, category } = this.storeRequest;
    this.appStoreForm = this.fb.group({
      titleImage: [titleImage ? titleImage : null, [Validators.required]],
      name: [name ? name : null, [Validators.required]],
      urlName: [urlName ? urlName : null, [Validators.required]],
      description: [description ? description : null, [Validators.required]],
      pricingType: [pricingType ? pricingType : PricingType.ONE_TIME, []],
      price: [price ? price : null, [Validators.required]],
      category: [category ? category : null, []],
    });

    this.subscriptions.push(this.appStoreForm.valueChanges.subscribe(newValue => {
      this.storeRequest = { ...this.storeRequest, ...newValue };
      this.node.name = this.storeRequest.name;
    }));

    if (this.disabled) {
      this.appStoreForm.disable();
    }
  }

  private buildNodeStylingForm() {
    const { initial }  = this.storeRequest as any;
    const { nodeStyling = {} } = initial || {};
    this.nodeStylingForm = this.fb.group({
      backgroundColor: nodeStyling ? nodeStyling.backgroundColor : null,
      borderColor: nodeStyling ? nodeStyling.borderColor : null,
      logo: nodeStyling ? nodeStyling.logo : '',
    });

    if (this.disabled) {
      this.nodeStylingForm.disable();
    }

    this.subscriptions.push(this.nodeStylingForm.valueChanges.subscribe(newValue => {
      this.storeRequest = {
        ...this.storeRequest,
        nodeStyling: {
          ...(this.storeRequest && this.storeRequest.nodeStyling || {}),
          ...newValue,
        }
      };
      this.node = {
        ...this.node,
        storeRequest: this.storeRequest,
      };
    }));
  }

  saveStoreRequest(event: Event) {
    this.stopEvent(event);
    this.submitted = true;

    if (this.appStoreForm.invalid) {
      this.switchTab(this.tabTypes.INFORMATION);
      return;
    }

    if (this.disabled || this.nodeStylingForm.invalid) {
      return;
    }

    const storeRequest = {
      ...this.storeRequest,
      images: this.storeRequest.images || [],
      provisionalNode: this.node._id,
      inputs: [],
      outputs: [],
    } as StoreRequestForm;

    if (!this.disabled) {
      this.storeRequestsRestService.create(storeRequest as any).subscribe((request) => {
          this.toastrService.success('Request successfully created');
          this.saveCallback(request);
          this.closeModal();
        },
        (error: Error) => {
          this.toastrService.error(error.message || 'Unable to create request');
        });
    }
  }

  loadCategories() {
    this.subscriptions.push(this.categoriesRestService.list('APP').subscribe((categories: any[]) => {
      this.categories = categories;
    }));
  }

  onSuccessUpload(event: any) {
    this.itemImageFile = new FileItem();
    this.itemImages.push(event.signedUrl);
    this.itemImageFile._id = event._id;
    this.itemImageFile.filename = event.name;
    this.itemImageFile.mimetype = event.contentType;
    this.itemImageFile.url = event.signedUrl;
    this.itemImageFiles.push(this.itemImageFile);
    this.imageLoading = true;
    const images = this.storeRequest.images || [];
    this.storeRequest = { ...this.storeRequest, images: [...images, this.itemImageFile] };
  }

  onSuccessAvatarUpload(event: any) {
    this.itemAvatarImageFile = new FileItem();
    this.itemAvatarImageFile._id = event._id;
    this.itemAvatarImageFile.filename = event.name;
    this.itemAvatarImageFile.mimetype = event.contentType;
    this.itemAvatarImageFile.url = event.signedUrl;
    this.imageAvatarLoading = true;
    this.storeRequest = { ...this.storeRequest, titleImage: this.itemAvatarImageFile };
    this.appStoreForm.get('titleImage').setValue(this.itemAvatarImageFile);
  }

  onSuccessLogoUpload(event: any) {
    this.itemLogoImageFile = new FileItem();
    this.itemLogoImageFile._id = event._id;
    this.itemLogoImageFile.filename = event.name;
    this.itemLogoImageFile.mimetype = event.contentType;
    this.itemLogoImageFile.url = event.signedUrl;
    this.imageLogoLoading = true;
    this.storeRequest = { ...this.storeRequest };
    this.storeRequest.nodeStyling = { ...this.storeRequest.nodeStyling, logo: this.itemLogoImageFile };
    this.nodeStylingForm.get('logo').setValue(this.itemLogoImageFile);
  }

  ngOnDestroy() {
    try {
      for (const subscription of this.subscriptions) {
        subscription.unsubscribe();
      }
    } catch (e) {
    }
  }

  closeModal(event?: Event) {
    if (event) {
      this.stopEvent(event);
    }
    this.settingsProjectModalRef.hide();
  }

  show(data: { node: FunctionalNode, callback: any }) {
    this.clearData();
    this.loading = true;

    this.node = {
      ...data.node,
    };
    this.saveCallback = data.callback;
    this.activeTab = this.tabTypes.INFORMATION;
    this.loadCategories();
    this.createTabs();
    this.storeRequestsRestService.getByNode(this.node._id)
      .subscribe(request => {
          if (request) {
            this.disabled = true;
            const {
              titleImage,
              name,
              nodeStyling,
              urlName,
              description,
              pricingType,
              category,
              images,
            } = request.initial ? request.initial : {} as any;
            this.storeRequest = {
              ...request,
              titleImage,
              images,
              name,
              nodeStyling,
              urlName,
              description,
              pricingType,
              category,
            };
            this.node.marketplaceSettings = this.storeRequest.initial as any;
          } else {
            this.storeRequest = {
              type: 'PROVISIONAL',
            } as StoreRequest;
          }

          this.buildMarketplaceRequestForm();
          this.buildNodeStylingForm();
          this.loading = false;
        },
        (error: Error) => {
          this.toastrService.error(error.message || 'Unable to load marketplace settings');
        });

    this.settingsProjectModalRef = this.modalService.show(this.settingsProjectModal,
      Object.assign({}, { class: 'custom-modal custom-modal--medium' })
    );
  }

  createTabs() {
    this.tabs = Object.keys(Tab).map((tab, i) => ({
      label: `${i + 1} ${tab.split('_')
        .map((item, itemIndex) => ((itemIndex === 0 ? item.substring(0, 1)
          : item.substring(0, 1).toLowerCase()) + item.substring(1).toLowerCase())).join(' ')}`,
      key: tab as any,
    }));
  }

  switchTab(tab: Tab.INFORMATION | Tab.CUSTOMIZATION, event?: Event) {
    if (event) {
      this.stopEvent(event);
    }
    this.viewedTabs.push(tab);
    this.activeTab = tab;
  }

  switchToNextTab(event: Event) {
    this.stopEvent(event);

    switch (this.activeTab) {
      case Tab.INFORMATION:
        this.viewedTabs.push(Tab.CUSTOMIZATION);
        this.activeTab = Tab.CUSTOMIZATION;
        break;
      case Tab.CUSTOMIZATION:
        this.activeTab = Tab.INFORMATION;
        this.viewedTabs.push(Tab.INFORMATION);
        break;
      default:
        this.activeTab = Tab.INFORMATION;
    }
  }

  itemAvatarImageRemove() {
    delete this.storeRequest.titleImage;
    this.appStoreForm.get('titleImage').reset();
    this.storeRequest = { ...this.storeRequest };
  }

  removeScreenshot(i: number) {
    this.storeRequest.images.splice(i, 1);
    this.storeRequest = { ...this.storeRequest };
  }

  removeLogo(event: Event) {
    this.stopEvent(event);
    delete this.storeRequest.nodeStyling.logo;
    this.nodeStylingForm.get('logo').reset();
    this.storeRequest = { ...this.storeRequest };
  }

  clearData() {
    this.storeRequest = null;
    this.submitted = false;
    this.viewedTabs = [];
    this.disabled = false;
    this.tabs = [];
    this.node = null;
  }

  stopEvent(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }
}
