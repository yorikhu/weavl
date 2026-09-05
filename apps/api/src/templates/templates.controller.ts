import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { registry } from './registry';

@Controller('templates')
export class TemplatesController {
  /** 模板列表 —— 前端预设广场/市场页数据源 */
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

  /** 模板详情（含完整编排） */
  @Get(':id')
  detail(@Param('id') id: string) {
    const t = registry.get(id);
    if (!t) throw new NotFoundException(`模板不存在: ${id}`);
    return t;
  }
}
