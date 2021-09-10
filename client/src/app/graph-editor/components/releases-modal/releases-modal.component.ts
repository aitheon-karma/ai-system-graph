import { Release } from '@aitheon/creators-studio';
import { NodesRestService } from '@aitheon/system-graph';
import { Component, TemplateRef, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { NodeData } from '../../../shared/models/node.model';

@Component({
  selector: 'ai-releases-modal',
  templateUrl: './releases-modal.component.html',
  styleUrls: ['./releases-modal.component.scss']
})
export class ReleasesModalComponent {
  @ViewChild('releasesModal') releasesModal: TemplateRef<any>;

  releasesModalRef: BsModalRef;
  data: NodeData;
  releases: any[];
  releasesForm: FormGroup;
  project: any;
  currentRelease: any;

  constructor(
    private modalService: BsModalService,
    private nodesRestService: NodesRestService,
  ) {}

  public show(data: any) {
    this.data = data;
    this.project = data.project;
    this.nodesRestService.getReleasesByProject(this.project._id || this.project).subscribe((releases: Release[]) => {
      this.releases = releases;

      // this.data.release leaved for compatibility
      const currentReleaseId = this.data.graphNode && this.data.graphNode.release && this.data.graphNode.release._id || this.data.release;
      this.currentRelease = this.releases.find(rel => rel._id === currentReleaseId);
      this.releasesModalRef = this.modalService.show(this.releasesModal, {
        ignoreBackdropClick: true,
      });
      this.initForm();
    });

  }

  initForm() {
    this.releasesForm = new FormGroup({
      release: new FormControl(this.currentRelease, Validators.required),
    });
  }

  hide() {
    this.releasesModalRef.hide();
    this.data = null;
  }

  onSave(event: Event) {
    this.stopEvent(event);
    const formValue = this.releasesForm.value;
    const { release } = formValue;
      (this.data as any).callback({
        release,
        isLatest: this.checkReleaseDate(release),
      } as any);
      this.hide();
  }

  checkReleaseDate(release: Release) {
    const releaseDate = Number(new Date(release.createdAt));
    // tslint:disable-next-line:no-shadowed-variable
    for (const release of this.releases) {
      if (Number(new Date(release.createdAt)) > releaseDate) {
        return false;
      }
    }
    return true;
  }

  stopEvent(event: Event) {
    event.preventDefault();
    event.stopPropagation();
  }
}
