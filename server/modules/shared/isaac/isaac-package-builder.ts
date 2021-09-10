import { validate } from 'class-validator';
import { IsaacPackageBuilderFactory } from './isaac-package-builder-factory';
import { FunctionalNode, NodeSettings, RuntimeParameters } from '../../nodes/node-functional.model';
import { SocketMetadata, Node } from '../../nodes/node.model';
import { ConnectionType, Graph as AitheonGraph, SocketJunctionPoint } from '../../graph/graph.model';
import { FunctionalGraphNode, SubgraphGraphNode, isSubgraphGraphNode } from '../../graph/graph-nodes.model';
import { IsaacApp, IsaacComponent, IsaacEdge, IsaacNode, IsaacSubgraphApp, IsaacSubgraphNode } from './isaac-app';
import { BazelMainTargetBuild } from './isaac-bazel-build';

export enum SocketDirection {
    InboundSocket,
    OutboundSocket
}

export function normalizeName(name: string): string {
    return name.replace(/\s+/g, '_');
}

export class IsaacPackageBuilder {

    constructor(aitheonGraph: AitheonGraph, isaacApp: IsaacSubgraphApp, bazelBuild: BazelMainTargetBuild) {
        this.aitheonGraph = aitheonGraph;
        this.isaacApp = isaacApp;
        this.bazelBuild = bazelBuild;
    }

    public buildAll(): IsaacPackageBuilder {
        return this.buildNodesAndBazel()
            .buildSubgraphNodesAndBazel()
            .buildEdges();
    }

    public buildNodesAndBazel(): IsaacPackageBuilder {
        for (const graphNode of this.aitheonGraph.graphNodes) {
            const isaacNode = this.constructNode(graphNode);
            this.isaacApp.graph.nodes.push(isaacNode);
            this.constructNodeBuild((graphNode.node as FunctionalNode).runtimeParameters);
        }
        return this;
    }

    public buildSubgraphNodesAndBazel(): IsaacPackageBuilder {
        for (const subgraphNode of this.aitheonGraph.subgraphNodes) {
            const { isaacSubgraphNode, subgraphBazelTarget } = this.constructSubgraphNode(subgraphNode);
            this.isaacApp.graph.nodes.push(isaacSubgraphNode);
            this.constructSubgraphNodeBuild(subgraphBazelTarget);
        }
        return this;
    }

    public buildEdges(): IsaacPackageBuilder {
        for (const conn of this.aitheonGraph.connections) {
            const isaacEdge = new IsaacEdge();

            // Skip interface connections if a subgraph is being processed as a graph
            if (conn.source.type === ConnectionType.INTERFACE || conn.target.type === ConnectionType.INTERFACE) {
                this.connectionsSkipCount++;
                continue;
            }
            isaacEdge.source = this.constructEdgePath(conn.source, SocketDirection.OutboundSocket);
            isaacEdge.target = this.constructEdgePath(conn.target, SocketDirection.InboundSocket);

            this.isaacApp.graph.edges.push(isaacEdge);
        }
        return this;
    }

    public getIsaacApp(): IsaacApp | IsaacSubgraphApp {
        validate(this.isaacApp).then(errors => {
            if (errors.length > 0) {
                throw new Error(`Isaac App validation failed. Errors: ${errors.toString()}`);
            }
        });
        if (!this.edgesCountIsValid()) {
            throw new Error(`Isaac App validation failed. Edges count is inconsistent`);
        }
        return this.isaacApp;
    }

    public getBazelBuild(): BazelMainTargetBuild {
        validate(this.bazelBuild).then(errors => {
            if (errors.length > 0) {
                throw new Error(`Isaac Build validation failed. Errors: ${errors.toString()}`);
            }
        });
        return this.bazelBuild;
    }

    protected edgesCountIsValid(): boolean {
        return this.aitheonGraph.connections.length - this.connectionsSkipCount === this.isaacApp.graph.edges.length;
    }

    protected createMessageComponent(): IsaacComponent {
        return new IsaacComponent('message_ledger', 'isaac::alice::MessageLedger');
    }

    protected constructNode(graphNode: FunctionalGraphNode): IsaacNode {

        const isaacNode = new IsaacNode();
        isaacNode.name = normalizeName(graphNode.graphNodeName);

        isaacNode.components.push(this.createMessageComponent());

        const funcNode = graphNode.node as FunctionalNode;
        const isaacComponent = new IsaacComponent(
            normalizeName(funcNode.name),
            funcNode.runtimeParameters.type
        );
        isaacNode.components.push(isaacComponent);

        const params = this.constructNodeConfig((graphNode as FunctionalGraphNode).instanceVariables.settings);

        if (Object.keys(params).length > 0) {
            this.isaacApp.config[isaacNode.name] = { [isaacComponent.name]: params };
        }

        return isaacNode;
    }

    protected constructSubgraphNode(subgraphNode: SubgraphGraphNode)
        : { isaacSubgraphNode: IsaacSubgraphNode, subgraphBazelTarget: BazelMainTargetBuild } {
        const isaacSubgraphNode = new IsaacSubgraphNode();
        isaacSubgraphNode.name = normalizeName(subgraphNode.graphNodeName);

        const subgraphPackageBuilder = IsaacPackageBuilderFactory.createSubgraphBuilder(subgraphNode.graph);
        // TODO: Use to generate subgraphs recursively
        // subgraphPackageBuilder.buildAll();
        const subgraphBazelTarget = subgraphPackageBuilder.getBazelBuild();
        isaacSubgraphNode.subgraph = subgraphBazelTarget.getJsonName();

        return { isaacSubgraphNode, subgraphBazelTarget };
    }

    protected constructNodeBuild(runtimeParameters: RuntimeParameters) {
        if (this.isaacApp.modules.indexOf(runtimeParameters.module) === -1) {
            this.isaacApp.modules.push(runtimeParameters.module);
        }
        this.bazelBuild.addModuleToTarget(runtimeParameters.build);
    }

    protected constructSubgraphNodeBuild(subgraphTarget: BazelMainTargetBuild) {
        this.bazelBuild.addDataToTarget(subgraphTarget.getTargetName());
    }

    protected constructNodeConfig(settings: NodeSettings): any {

        const params: any = {};

        for (const { name, mandatory, value } of settings.parameters) {
            if (value) {
                params[name] = value;
            } else if (mandatory) {
                throw new Error(`Invalid Aitheon Graph. Mandatory param '${name}' is not set in the node with settings ID ${settings._id}`);
            }
        }
        // TO_DO: must be reworked for array of ticks
        // if (settings.tick.enabled) {
        //     params['tick_period'] = settings.tick.interval;
        // }

        return params;
    }

    protected constructEdgePath(point: SocketJunctionPoint, socketDirection: SocketDirection): string {
        const graphNode = [...this.aitheonGraph.graphNodes, ...this.aitheonGraph.subgraphNodes]
            .find(node => node._id === point.graphNodeId);
        if (!graphNode) {
            throw new Error(`Invalid Aitheon Graph. Graph node [${point.graphNodeId}] not found`);
        }

        const { inputs, outputs } = isSubgraphGraphNode(graphNode) ? graphNode.graph as AitheonGraph : graphNode.node as Node;
        const sockets = socketDirection === SocketDirection.InboundSocket ? inputs : outputs;
        const socketMetadata = sockets.find(({ _id }) => _id.toString() === point.socketMetadataId.toString()) as SocketMetadata;
        if (!socketMetadata) {
            throw new Error(`Invalid Aitheon Graph. Socket metadata ID: ${point.socketMetadataId} not found`);
        }

        const nn = normalizeName;
        if (isSubgraphGraphNode(graphNode)) {
            // TODO rework in case of updated Model
            // return `${nn(point.graphNodeName)}.subgraph/interface/${nn(socketMetadata.name)}`;
        }
        // TODO rework in case of updated Model
        // return `${nn(point.graphNodeName)}/${nn((graphNode.node as Node).name)}/${nn(socketMetadata.name)}`;
        return '';
    }

    protected aitheonGraph: AitheonGraph;
    protected isaacApp: IsaacSubgraphApp | IsaacApp;
    protected bazelBuild: BazelMainTargetBuild;
    private connectionsSkipCount: number = 0;
}
