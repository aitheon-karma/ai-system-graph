import { IsString, ArrayMinSize, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BazelLoad {
    constructor(bzlPath: string, symbols: string[]) {
        this.bzlPath = bzlPath;
        this.symbols = symbols;
    }

    @IsString()
    @IsNotEmpty()
    private  bzlPath: string;

    @ValidateNested({ each: true })
    @Type(() => String)
    @ArrayMinSize(1)
    private  symbols: string[];

    toString(): string {
        return `load("${this.bzlPath}", "${this.symbols.join('", "')}")`;
    }
}

export class BazelIsaacComponent {
    constructor(name: string) {
        this.name = name;
    }

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    fileName: string;

    @ValidateNested({ each: true })
    @Type(() => String)
    visibility: string[] = [];

    @ValidateNested({ each: true })
    @Type(() => String)
    deps: string[] = [];

    toString(): string {
        return `isaac_component(
            name = "${this.name}", \
            ${ this.fileName && this.fileName.length > 0 ? `\n\t\t\tfilename = "${this.fileName}",` : '' } \
            ${ this.visibility.length > 0 ? `\n\t\t\tvisibility = ["${this.visibility.join('", "')}"],` : '' } \
            ${ this.deps.length > 0 ? `\n\t\t\tdeps = ["${this.deps.join('", "')}"]` : '' }
        )`;
    }
}

export class BazelIsaacCcModule {
    constructor(name: string) {
        this.name = name;
    }

    @IsString()
    @IsNotEmpty()
    name: string;

    @ValidateNested({ each: true })
    @Type(() => String)
    srcs: string[] = [];

    @ValidateNested({ each: true })
    @Type(() => String)
    hdrs: string[] = [];

    @ValidateNested({ each: true })
    @Type(() => String)
    visibility: string[] = [];

    @ValidateNested({ each: true })
    @Type(() => String)
    deps: string[] = [];

    @ValidateNested({ each: true })
    @Type(() => String)
    tags: string[] = [];

    toString(): string {
        return `isaac_cc_module(
            name = "${this.name}", \
            ${ this.srcs.length > 0 ? `\n\t\t\tsrcs = ["${this.srcs.join('", "')}"],` : '' } \
            ${ this.hdrs.length > 0 ? `\n\t\t\thdrs = ["${this.hdrs.join('", "')}"],` : '' } \
            ${ this.visibility.length > 0 ? `\n\t\t\tvisibility = ["${this.visibility.join('", "')}"],` : '' } \
            ${ this.deps.length > 0 ? `\n\t\t\tdeps = ["${this.deps.join('", "')}"]` : '' } \
            ${ this.tags.length > 0 ? `\n\t\t\ttags = ["${this.tags.join('", "')}"]` : '' }
        )`;
    }
}

export class BazelIsaacSubgraph {
    constructor(name: string) {
        this.name = name;
        this.subgraph = `${name}.subgraph.json`;
    }

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    subgraph: string;

    @ValidateNested({ each: true })
    @Type(() => String)
    data: string[] = [];

    @ValidateNested({ each: true })
    @Type(() => String)
    modules: string[] = [];

    @ValidateNested({ each: true })
    @Type(() => String)
    visibility: string[] = [];

    toString(): string {
        return `isaac_subgraph(
            name = "${this.name}",
            subgraph = "${this.subgraph}", \
            ${ this.data.length > 0 ? `\n\t\t\tdata = ["${this.data.join('", "')}"],` : '' } \
            ${ this.modules.length > 0 ? `\n\t\t\tmodules = ["${this.modules.join('", "')}"],` : '' } \
            ${ this.visibility.length > 0 ? `\n\t\t\tvisibility = ["${this.visibility.join('", "')}"],` : '' }
        )`;
    }
}

export class BazelIsaacApp {
    constructor(name: string) {
        this.name = name;
        this.app_json_file = `${name}.app.json`;
    }

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    app_json_file: string;

    @ValidateNested({ each: true })
    @Type(() => String)
    data: string[] = [];

    @ValidateNested({ each: true })
    @Type(() => String)
    modules: string[] = [];

    @ValidateNested({ each: true })
    @Type(() => String)
    tags: string[] = [];

    toString(): string {
        return `isaac_app(
            name = "${this.name}",
            app_json_file = "${this.app_json_file}", \
            ${ this.data.length > 0 ? `\n\t\t\tdata = ["${this.data.join('", "')}"],` : '' } \
            ${ this.modules.length > 0 ? `\n\t\t\tmodules = ["${this.modules.join('", "')}"],` : '' } \
            ${ this.tags.length > 0 ? `\n\t\t\ttags = ["${this.tags.join('", "')}"]` : '' }
        )`;
    }
}