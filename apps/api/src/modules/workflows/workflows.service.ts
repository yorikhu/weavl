import { BadRequestException, Injectable } from "@nestjs/common";
import type { WorkflowDefinition, WorkflowField, WorkflowRunRecord, WorkflowStage } from "@weavl/shared";
import { newId } from "../../common/id";
import type { Prisma, Workflow, WorkflowRun } from "@prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { AssetsService } from "../assets/assets.service";
import { ProjectsService } from "../projects/projects.service";
@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly projects: ProjectsService,
  ) {}
  async list(userId: string) {
    return (
      await this.prisma.workflow.findMany({
        where: { OR: [{ ownerId: userId }, { status: "published" }] },
        orderBy: { updatedAt: "desc" },
      })
    ).map((x) => this.mapWorkflow(x));
  }
  async get(id: string, userId: string) {
    return this.mapWorkflow(await this.accessibleRow(id, userId));
  }
  async create(
    userId: string,
    x: {
      title: string;
      description: string;
      category: string;
      fields: WorkflowField[];
      stages: WorkflowStage[];
      graph?: Record<string, unknown>;
    },
  ) {
    return this.mapWorkflow(
      await this.prisma.workflow.create({
        data: {
          id: newId("workflow"),
          ownerId: userId,
          title: x.title,
          description: x.description,
          category: x.category,
          fields: x.fields as Prisma.InputJsonValue,
          stages: x.stages as Prisma.InputJsonValue,
          graph: x.graph as Prisma.InputJsonValue | undefined,
        },
      }),
    );
  }
  async update(
    id: string,
    userId: string,
    x: Partial<{
      title: string;
      description: string;
      category: string;
      fields: WorkflowField[];
      stages: WorkflowStage[];
      graph: Record<string, unknown>;
      status: "draft" | "published";
    }>,
  ) {
    await this.ownedRow(id, userId);
    const definitionChanged = Object.keys(x).some((key) => key !== "graph");
    return this.mapWorkflow(
      await this.prisma.workflow.update({
        where: { id },
        data: {
          title: x.title,
          description: x.description,
          category: x.category,
          fields: x.fields as Prisma.InputJsonValue | undefined,
          stages: x.stages as Prisma.InputJsonValue | undefined,
          graph: x.graph as Prisma.InputJsonValue | undefined,
          status: x.status,
          version: definitionChanged ? { increment: 1 } : undefined,
          updatedAt: new Date(),
        },
      }),
    );
  }
  async runs(userId: string, workflowId?: string) {
    return (
      await this.prisma.workflowRun.findMany({ where: { ownerId: userId, workflowId }, orderBy: { updatedAt: "desc" } })
    ).map((x) => this.mapRun(x));
  }
  async run(runId: string, userId: string) {
    const run = await this.prisma.workflowRun.findFirst({ where: { id: runId, ownerId: userId } });
    if (!run) throw new BadRequestException("运行不存在或无权访问");
    return this.mapRun(run);
  }
  async createRun(workflowId: string, userId: string, input: { inputs: Record<string, string>; projectId?: string }) {
    const workflow = await this.get(workflowId, userId);
    if (workflow.status !== "published") throw new BadRequestException("工作流尚未发布");
    for (const field of workflow.fields) {
      if (field.required && !input.inputs[field.id]?.trim()) throw new BadRequestException(`请填写「${field.label}」`);
      if (field.type === "asset" && input.inputs[field.id])
        await this.assets.findOwned(input.inputs[field.id]!, userId);
    }
    if (input.projectId) await this.projects.get(input.projectId, userId);
    const snapshot = {
      title: workflow.title,
      description: workflow.description,
      fields: workflow.fields,
      stages: workflow.stages,
      version: workflow.version,
    };
    const stages = workflow.stages.map((stage) => ({
      stageId: stage.id,
      status: "pending" as const,
      attempts: 0,
      assetRefs: [],
    }));
    const run = await this.prisma.workflowRun.create({
      data: {
        id: newId("wrun"),
        ownerId: userId,
        workflowId,
        workflowVersion: workflow.version,
        definitionSnapshot: snapshot as Prisma.InputJsonValue,
        projectId: input.projectId,
        inputs: input.inputs,
        stages: stages as Prisma.InputJsonValue,
        status: "running",
      },
    });
    return this.advance(run.id, userId);
  }
  async decide(runId: string, userId: string, action: "approve" | "retry", content?: string) {
    const run = await this.run(runId, userId);
    if (run.status !== "awaiting_review") throw new BadRequestException("当前没有待审核节点");
    if (action === "retry") return this.retryAt(run, run.currentStage, userId);
    const stage = run.stages[run.currentStage]!;
    if (content !== undefined) {
      const ref = stage.assetRefs.at(-1);
      if (ref) {
        const asset = await this.assets.update(ref.assetId, userId, { content });
        stage.assetRefs.push({ assetId: asset.id, versionId: asset.versions.at(-1)!.id });
      }
    }
    stage.status = "approved";
    run.currentStage += 1;
    run.status = "running";
    await this.saveRun(run);
    return this.advance(runId, userId);
  }
  async retry(runId: string, userId: string, stageId: string) {
    const run = await this.run(runId, userId);
    const index = run.stages.findIndex((x) => x.stageId === stageId);
    if (index < 0 || run.stages[index]?.status === "pending") throw new BadRequestException("该阶段尚未运行");
    return this.retryAt(run, index, userId);
  }
  async cancel(runId: string, userId: string) {
    const run = await this.run(runId, userId);
    if (run.status === "succeeded") throw new BadRequestException("已完成的运行无法终止");
    run.status = "cancelled";
    run.updatedAt = new Date().toISOString();
    await this.saveRun(run);
    return run;
  }
  private async retryAt(run: WorkflowRunRecord, index: number, userId: string) {
    run.currentStage = index;
    run.status = "running";
    run.stages.slice(index).forEach((x) => {
      x.status = "pending";
    });
    await this.saveRun(run);
    return this.advance(run.id, userId);
  }
  private async advance(runId: string, userId: string) {
    const run = await this.run(runId, userId);
    const workflow = run.definitionSnapshot ?? (await this.get(run.workflowId, userId));
    while (run.currentStage < workflow.stages.length) {
      const definition = workflow.stages[run.currentStage]!;
      const stage = run.stages[run.currentStage]!;
      const first = Object.values(run.inputs).find(Boolean) || workflow.title;
      const text = `【模拟产物 · 第 ${stage.attempts + 1} 版】\n${definition.title}\n\n任务：${workflow.title}\n输入摘要：${first.slice(0, 160)}\n处理方法：${definition.instruction}\n\n本阶段建议：\n1. 核实原始资料与业务目标。\n2. 用清晰结构组织可交付内容。\n3. 在审核后继续下一阶段。`;
      const previous = stage.assetRefs.at(-1);
      if (previous) {
        const asset = await this.assets.update(previous.assetId, userId, { content: text });
        stage.assetRefs.push({ assetId: asset.id, versionId: asset.versions.at(-1)!.id });
      } else {
        const asset = await this.assets.create({
          ownerId: userId,
          name: `${workflow.title} · ${definition.title}`,
          kind: "text",
          source: "workflow",
          sourceId: run.id,
          inLibrary: false,
          content: text,
        });
        stage.assetRefs.push({ assetId: asset.id, versionId: asset.versions[0]!.id });
      }
      stage.attempts += 1;
      if (definition.visibility === "review") {
        stage.status = "waiting";
        run.status = "awaiting_review";
        run.updatedAt = new Date().toISOString();
        await this.saveRun(run);
        return run;
      }
      stage.status = "completed";
      run.currentStage += 1;
    }
    run.status = "succeeded";
    run.updatedAt = new Date().toISOString();
    await this.saveRun(run);
    return run;
  }
  private saveRun(run: WorkflowRunRecord) {
    return this.prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: run.status,
        stages: run.stages as Prisma.InputJsonValue,
        currentStage: run.currentStage,
        updatedAt: new Date(),
      },
    });
  }
  private async accessibleRow(id: string, userId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, OR: [{ ownerId: userId }, { status: "published" }] },
    });
    if (!workflow) throw new BadRequestException("工作流不存在");
    return workflow;
  }
  private async ownedRow(id: string, userId: string) {
    const workflow = await this.prisma.workflow.findFirst({ where: { id, ownerId: userId } });
    if (!workflow) throw new BadRequestException("工作流不存在或无权访问");
    return workflow;
  }
  private mapWorkflow(x: Workflow): WorkflowDefinition {
    return {
      id: x.id,
      ownerId: x.ownerId,
      title: x.title,
      description: x.description,
      category: x.category,
      version: x.version,
      status: x.status as "draft" | "published",
      fields: x.fields as WorkflowField[],
      stages: x.stages as WorkflowStage[],
      graph: x.graph as Record<string, unknown> | undefined,
      createdAt: x.createdAt.toISOString(),
      updatedAt: x.updatedAt.toISOString(),
    };
  }
  private mapRun(x: WorkflowRun): WorkflowRunRecord {
    return {
      id: x.id,
      ownerId: x.ownerId,
      workflowId: x.workflowId,
      workflowVersion: x.workflowVersion,
      definitionSnapshot: x.definitionSnapshot as WorkflowRunRecord["definitionSnapshot"],
      projectId: x.projectId || undefined,
      inputs: x.inputs as Record<string, string>,
      status: x.status as WorkflowRunRecord["status"],
      stages: x.stages as WorkflowRunRecord["stages"],
      currentStage: x.currentStage,
      createdAt: x.createdAt.toISOString(),
      updatedAt: x.updatedAt.toISOString(),
    };
  }
}
