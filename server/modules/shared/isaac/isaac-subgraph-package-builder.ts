import { IsaacPackageBuilder, SocketDirection, normalizeName } from './isaac-package-builder';
import { ConnectionType, Graph as AitheonGraph, SocketJunctionPoint } from '../../graph/graph.model';
import { IsaacComponent, IsaacEdge, IsaacNode, IsaacSubgraphApp } from './isaac-app';
import { BazelMainTargetBuild } from './isaac-bazel-build';

export class IsaacSubgraphPackageBuilder extends IsaacPackageBuilder {
    constructor(aitheonGraph: AitheonGraph, isaacApp: IsaacSubgraphApp, bazelBuild: BazelMainTargetBuild) {
        super(aitheonGraph, isaacApp, bazelBuild);

        const isaacIfaceNode = this.constructIfaceNodeForSubgraph();
        this.isaacApp.graph.nodes.push(isaacIfaceNode);
    }

    public buildEdges(): IsaacPackageBuilder {
        for (const conn of this.aitheonGraph.connections) {
            const isaacEdge = new IsaacEdge();

            if (conn.source.type === ConnectionType.INTERFACE) {
                isaacEdge.source = this.constructIfacePath(conn.source, SocketDirection.InboundSocket);
                isaacEdge.target = this.constructEdgePath(conn.target, SocketDirection.InboundSocket);
            } else if (conn.target.type === ConnectionType.INTERFACE) {
                isaacEdge.source = this.constructEdgePath(conn.source, SocketDirection.OutboundSocket);
                isaacEdge.target = this.constructIfacePath(conn.target, SocketDirection.OutboundSocket);
            } else {
                isaacEdge.source = this.constructEdgePath(conn.source, SocketDirection.OutboundSocket);
                isaacEdge.target = this.constructEdgePath(conn.target, SocketDirection.InboundSocket);
            }

            this.isaacApp.graph.edges.push(isaacEdge);
        }

        return this;
    }

    private constructIfacePath(point: SocketJunctionPoint, socketDirection: SocketDirection) {
        const sockets = socketDirection === SocketDirection.InboundSocket ? this.aitheonGraph.inputs : this.aitheonGraph.outputs;
        if (!sockets || sockets.length === 0) {
            throw new TypeError(`Graph ${this.aitheonGraph._id.toString()} has invalid interface`);
        }
        const ifaceSocketMeta = sockets.find(({ _id }) => _id.toString() === point.socketMetadataId.toString());
        const nn = normalizeName;
        return `subgraph/interface/${nn(ifaceSocketMeta.name)}`;
    }

    private constructIfaceNodeForSubgraph(): IsaacNode {
        const isaacIfaceNode = new IsaacNode();
        isaacIfaceNode.name = 'subgraph';
        isaacIfaceNode.components.push(this.createMessageComponent());
        isaacIfaceNode.components.push(this.createSubgraphComponent());
        return isaacIfaceNode;
    }

    private createSubgraphComponent(): IsaacComponent {
        return new IsaacComponent('interface', 'isaac::alice::Subgraph');
    }
}
