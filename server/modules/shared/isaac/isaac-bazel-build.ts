import { RuntimeBuild, FunctionalNode } from '../../nodes/node-functional.model';
import { FunctionalNodeGroup } from '../../nodes/node-group.model';
import { BazelIsaacComponent, BazelIsaacCcModule, BazelLoad, BazelIsaacSubgraph, BazelIsaacApp } from './isaac-bazel';

export interface BazelMainTargetBuild {
    getTargetName(): string;
    getJsonName(): string;
    addModuleToTarget(runtimeBuild: RuntimeBuild): void;
    addDataToTarget(data: string): void;
}

export class BazelBuild {

    createModule(runtimeBuild: RuntimeBuild) {
        const isaacModule = new BazelIsaacCcModule(runtimeBuild.module);
        isaacModule.deps = runtimeBuild.dependencies;
        this.modules.push(isaacModule);

        if (this.bazelRules.indexOf('isaac_cc_module') === -1) {
            this.bazelRules.push('isaac_cc_module');
        }
    }

    createComponent(node: FunctionalNode) {
        const isaacComponent = new BazelIsaacComponent(node.name);
        isaacComponent.deps = node.runtimeParameters.build.dependencies;
        this.components.push(isaacComponent);

        if (this.bazelRules.indexOf('isaac_component') === -1) {
            this.bazelRules.push('isaac_component');
        }
    }

    toString(): string {
        this.load = new BazelLoad('//engine/build:isaac.bzl', this.bazelRules);

        return `${this.load}\n
        ${this.components.join('\n\n\t\t')}\n
        ${this.modules.join('\n\n\t\t')}`;
    }

    private components: BazelIsaacComponent[] = [];
    private modules: BazelIsaacCcModule[] = [];
    private load: BazelLoad;
    protected bazelRules: string[] = [];
}

export class BazelAppBuild extends BazelBuild implements BazelMainTargetBuild {

    constructor(name: string) {
        super();
        this.app = new BazelIsaacApp(name);
        if (this.bazelRules.indexOf('isaac_app') === -1) {
            this.bazelRules.push('isaac_app');
        }
    }

    getTargetName(): string {
        return this.app.name;
    }

    getJsonName(): string {
        return this.app.app_json_file;
    }

    addModuleToTarget(runtimeBuild: RuntimeBuild) {
        if (this.app.modules.indexOf(runtimeBuild.module) === -1) {
            this.app.modules.push(runtimeBuild.module);
        }
    }

    addDataToTarget(data: string) {
        if (this.app.data.indexOf(data) === -1) {
            this.app.data.push(data);
        }
    }

    toString(): string {
        return `${super.toString()}\n${this.app}`;
    }

    private app: BazelIsaacApp;
}

export class BazelSubgraphBuild extends BazelBuild implements BazelMainTargetBuild {
    constructor(name: string) {
        super();
        this.subgraph = new BazelIsaacSubgraph(name);
        if (this.bazelRules.indexOf('isaac_subgraph') === -1) {
            this.bazelRules.push('isaac_subgraph');
        }
    }

    getTargetName(): string {
        return this.subgraph.name;
    }

    getJsonName(): string {
        return this.subgraph.subgraph;
    }

    addModuleToTarget(runtimeBuild: RuntimeBuild) {
        if (this.subgraph.modules.indexOf(runtimeBuild.module) === -1) {
            this.subgraph.modules.push(runtimeBuild.module);
        }
    }

    addDataToTarget(data: string) {
        if (this.subgraph.data.indexOf(data) === -1) {
            this.subgraph.data.push(data);
        }
    }

    toString(): string {
        return `${super.toString()}\n${this.subgraph}`;
    }

    private subgraph: BazelIsaacSubgraph;
}

export class BazelDepsBuildGenerator {
    static generateBazelComponentBuild(node: FunctionalNode): BazelBuild {
        const bazelBuild = new BazelBuild();
        bazelBuild.createComponent(node);
        return bazelBuild;
    }

    static generateBazelModuleBuild(nodeGroup: FunctionalNodeGroup): BazelBuild {
        const bazelBuild = new BazelBuild();
        bazelBuild.createModule(nodeGroup.build);
        return bazelBuild;
    }
}