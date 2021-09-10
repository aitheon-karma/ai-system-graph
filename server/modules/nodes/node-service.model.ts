import { Schema, Document } from 'mongoose';
import { IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Node, NodeSchema } from './node.model';

@JSONSchema({ description: 'Service Node schema' })
export class ServiceNode extends Node {
    @IsString()
    service: string;
}

export function isServiceNode(node: Node): node is ServiceNode {
    return (node as ServiceNode).service !== undefined;
}

/**
 * Database schema/collection
 */
const serviceNodeSchema = new Schema({
    service: String
});

export type IServiceNode = Document & ServiceNode;
export const ServiceNodeSchema = NodeSchema.discriminator<IServiceNode>('ServiceNode', serviceNodeSchema);
