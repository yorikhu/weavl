import { CardNode } from "./nodes/CardNode";
import { ImageNode } from "./nodes/ImageNode";
import { TextNode } from "./nodes/TextNode";
import { VideoNode } from "./nodes/VideoNode";

export { ImageEditPanel } from "./nodes/ImageNode";
export { VideoEditPanel } from "./nodes/VideoNode";

/** React Flow 使用的画布节点类型注册表。 */
export const nodeTypes = { card: CardNode, image: ImageNode, text: TextNode, video: VideoNode };
