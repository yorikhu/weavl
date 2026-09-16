import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { newId } from "../../common/id";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { registry } from "../templates/registry";
import { RunEngine, type RunSnapshot } from "./run.engine";

/** Compatibility API for the older preset pages. State is persisted through Prisma instead of process memory. */
@Controller("runs")
export class RunsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Body() body: { templateId: string; inputs: Record<string, unknown> }) {
    const template = registry.get(body?.templateId);
    if (!template) throw new NotFoundException(`模板不存在: ${body?.templateId}`);
    if (!body.inputs || typeof body.inputs !== "object") throw new BadRequestException("inputs 必填");
    for (const definition of template.inputs) {
      if (definition.required && !String(body.inputs[definition.name] ?? "").trim()) {
        throw new BadRequestException(`缺少必填字段: ${definition.label}`);
      }
    }
    const engine = new RunEngine(newId("run"), template, body.inputs);
    const view = engine.start();
    await this.prisma.legacyRun.create({
      data: { id: view.id, templateId: template.id, state: engine.snapshot() as unknown as Prisma.InputJsonValue },
    });
    return view;
  }

  @Get("latest/_pick")
  async latest() {
    const run = await this.prisma.legacyRun.findFirst({ orderBy: { updatedAt: "desc" } });
    if (!run) throw new NotFoundException("暂无运行记录");
    return (run.state as unknown as RunSnapshot).view;
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const run = await this.prisma.legacyRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException(`运行不存在: ${id}`);
    return (run.state as unknown as RunSnapshot).view;
  }

  @Post(":id/decide")
  async decide(
    @Param("id") id: string,
    @Body() body: { action: "confirm" | "edit-confirm" | "regenerate"; candidateId?: string; note?: string },
  ) {
    if (!["confirm", "edit-confirm", "regenerate"].includes(body?.action)) {
      throw new BadRequestException("action 必须是 confirm | edit-confirm | regenerate");
    }
    if (body.action !== "regenerate" && !body.candidateId) throw new BadRequestException("采纳时必须提供 candidateId");
    const stored = await this.prisma.legacyRun.findUnique({ where: { id } });
    if (!stored) throw new NotFoundException(`运行不存在: ${id}`);
    const template = registry.get(stored.templateId);
    if (!template) throw new NotFoundException(`模板不存在: ${stored.templateId}`);
    const engine = RunEngine.restore(template, stored.state as unknown as RunSnapshot);
    try {
      const view = engine.decide(body);
      await this.prisma.legacyRun.update({
        where: { id },
        data: { state: engine.snapshot() as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
      });
      return view;
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}
