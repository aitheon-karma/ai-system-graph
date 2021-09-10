import { Graph as AitheonGraph } from '../../graph/graph.model';
import { IsaacApp, IsaacSubgraphApp } from './isaac-app';
import { BazelMainTargetBuild, BazelAppBuild, BazelSubgraphBuild } from './isaac-bazel-build';
import { IsaacPackageBuilder, normalizeName } from './isaac-package-builder';
import { IsaacSubgraphPackageBuilder } from './isaac-subgraph-package-builder';

export interface IsaacPackage {
    app: IsaacApp | IsaacSubgraphApp;
    build: BazelMainTargetBuild;
}

export class IsaacPackageBuilderFactory {
    static createSubgraphBuilder(aitheonSubgraph: AitheonGraph): IsaacSubgraphPackageBuilder {
        const isaacSubgraphApp = new IsaacSubgraphApp();
        const subgraphBazelBuild = new BazelSubgraphBuild(normalizeName(aitheonSubgraph.name));
        return new IsaacSubgraphPackageBuilder(aitheonSubgraph, isaacSubgraphApp, subgraphBazelBuild);
    }

    static createGraphBuilder(aitheonGraph: AitheonGraph): IsaacPackageBuilder {
        const graph = aitheonGraph;
        const isaacApp = new IsaacApp(normalizeName(aitheonGraph.name));
        const appBazelBuild = new BazelAppBuild(isaacApp.name);
        return new IsaacPackageBuilder(graph, isaacApp, appBazelBuild);
    }
}