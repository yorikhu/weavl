import { Controller, Get, Param, NotFoundException } from "@nestjs/common";
import { registry } from "./registry";

@Controller("templates")
export class TemplatesController {
  /**
   * 返回预设市场使用的模板摘要列表。
   *
   * @returns 不包含完整步骤定义的模板摘要。
   */
  @Get()
  list() {
    return registry.list().map((t) => ({
      id: t.id,
      name: t.name,
      vertical: t.vertical,
      category: t.category,
      price: t.price,
      cost: t.cost,
      inputs: t.inputs,
      gates: t.gates ?? [],
      totalSteps: t.steps.length,
    }));
  }

  /**
   * 返回包含完整编排定义的模板详情。
   *
   * @param id - 模板稳定标识。
   * @returns 完整模板定义。
   * @throws {NotFoundException} 模板不存在时抛出。
   */
  @Get(":id")
  detail(@Param("id") id: string) {
    const t = registry.get(id);
    if (!t) throw new NotFoundException(`模板不存在: ${id}`);
    return t;
  }
}
