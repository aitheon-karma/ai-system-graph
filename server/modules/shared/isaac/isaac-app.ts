import { IsNotEmpty, IsString, IsArray, ArrayUnique, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JSONSchema } from 'class-validator-jsonschema';

@JSONSchema({ description: 'ISAAC Edge schema' })
export class IsaacEdge {
    @IsString()
    source: string;

    @IsString()
    target: string;
}

@JSONSchema({ description: 'ISAAC Component schema' })
export class IsaacComponent {
    constructor(name: string, type: string) {
        this.name = name;
        this.type = type;
    }

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    type: string;
}

@JSONSchema({ description: 'ISAAC Base Node scheam'})
export class BaseIsaacNode {
    @IsString()
    @IsNotEmpty()
    name: string;
}

@JSONSchema({ description: 'ISAAC Node schema' })
export class IsaacNode extends BaseIsaacNode {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => IsaacComponent)
    components: IsaacComponent[] = [];
}

@JSONSchema({ description: 'ISAAC Subgraph Node schema' })
export class IsaacSubgraphNode extends BaseIsaacNode {
    @IsString()
    @IsNotEmpty()
    subgraph: string;
}

@JSONSchema({ description: 'ISAAC Graph schema' })
export class IsaacGraph {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BaseIsaacNode)
    // TODO: update class-transfomer
    // @Type(() => BaseIsaacNode, {
    //     discriminator: {
    //         property: "__type",
    //         subTypes: [
    //             { value: IsaacNode, name: "isaacNode" },
    //             { value: IsaacSubgraphNode, name: "isaacSubgraphNode" }
    //         ]
    //     }
    // })
    nodes: (IsaacNode | IsaacSubgraphNode)[] = [];

    @ValidateNested({ each: true })
    @Type(() => IsaacEdge)
    edges: IsaacEdge[] = [];
}

@JSONSchema({ description: 'ISAAC Subgraph App schema' })
export class IsaacSubgraphApp {
    @ValidateNested({ each: true })
    @Type(() => String)
    @ArrayUnique()
    modules: string[] = [];

    config: any = {};

    @ValidateNested()
    @Type(() => IsaacGraph)
    graph: IsaacGraph = new IsaacGraph();
}

@JSONSchema({ description: 'ISAAC App schema' })
export class IsaacApp extends IsaacSubgraphApp {
    constructor(name: string) {
        super();
        this.name = name;
    }

    @IsString()
    @IsNotEmpty()
    name: string;
}