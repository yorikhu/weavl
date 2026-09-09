import { Controller, Post, Get, Body, Param, NotFoundException, BadRequestException } from "@nestjs/common";
import { registry } from "../templates/registry";
import { RunEngine } from "./run.engine";

/**
 * 内存版运行存储（MVP 够用；接 DB 时替换 store 实现）
 */
const store = new Map<string, RunEngine>();
let seq = 0;

@Controller("runs")
export class RunsController {
  /** 创建并启动一次运行 */
  @Post()
  create(@Body() body: { templateId: string; inputs: Record<string, unknown> }) {
    const template = registry.get(body?.templateId);
    if (!template) throw new NotFoundException(`模板不存在: ${body?.templateId}`);
    if (!body.inputs || typeof body.inputs !== "object") throw new BadRequestException("inputs 必填");

    // 必填字段校验（表单 Schema 驱动）
    for (const def of template.inputs) {
      if (def.required && !String(body.inputs[def.name] ?? "").trim()) {
        throw new BadRequestException(`缺少必填字段: ${def.label}`);
      }
    }

    const id = `run_${Date.now()}_${++seq}`;
    const engine = new RunEngine(id, template, body.inputs);
    store.set(id, engine);
    return engine.start();
  }

  /** 最近一次运行（画布自动生成流程图用） */
  @Get("latest/_pick")
  latest() {
    let last: { id: string; updatedAt: string } | null = null;
    for (const [id] of store) {
      const v = store.get(id)!.view();
      if (!last || v.updatedAt > last.updatedAt) last = { id, updatedAt: v.updatedAt };
    }
    if (!last) throw new NotFoundException("暂无运行记录");
    return store.get(last.id)!.view();
  }

  /** 查询运行状态 */
  @Get(":id")
  get(@Param("id") id: string) {
    const engine = store.get(id);
    if (!engine) throw new NotFoundException(`运行不存在: ${id}`);
    return engine.view();
  }

  /** 确认门决策：confirm / edit-confirm / regenerate */
  @Post(":id/decide")
  decide(
    @Param("id") id: string,
    @Body() body: { action: "confirm" | "edit-confirm" | "regenerate"; candidateId?: string; note?: string },
  ) {
    const engine = store.get(id);
    if (!engine) throw new NotFoundException(`运行不存在: ${id}`);
    if (!["confirm", "edit-confirm", "regenerate"].includes(body?.action)) {
      throw new BadRequestException("action 必须是 confirm | edit-confirm | regenerate");
    }
    if (body.action !== "regenerate" && !body.candidateId) {
      throw new BadRequestException("采纳时必须提供 candidateId");
    }
    try {
      return engine.decide(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }
}
