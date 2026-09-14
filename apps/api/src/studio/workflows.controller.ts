import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { WorkflowDefinition, WorkflowRunRecord } from "@weavl/shared";
import { AuthRequest, owned, parseBody, SessionGuard } from "./http";
import { newId, StudioStore } from "./store";

const fieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "select", "asset"]),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});
const stageSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  instruction: z.string(),
  outputKind: z.enum(["text", "image", "video", "audio", "pdf", "word", "ppt", "file"]),
  visibility: z.enum(["hidden", "summary", "preview", "review"]),
});
const definitionSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().max(800),
  category: z.string().max(80),
  fields: z.array(fieldSchema),
  stages: z.array(stageSchema).min(1),
  graph: z.record(z.string(), z.unknown()).optional(),
});

@Controller("studio/workflows")
@UseGuards(SessionGuard)
export class WorkflowsController {
  constructor(private readonly store: StudioStore) {}

  @Get() list(@Req() req: AuthRequest) {
    return this.store
      .read()
      .workflows.filter((item) => item.ownerId === req.studioUser.id || item.status === "published");
  }
  @Get("runs") runs(@Req() req: AuthRequest, @Query("workflowId") workflowId?: string) {
    return this.store
      .read()
      .workflowRuns.filter((run) => run.ownerId === req.studioUser.id && (!workflowId || run.workflowId === workflowId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  @Get("runs/:runId") run(@Req() req: AuthRequest, @Param("runId") runId: string) {
    return owned(this.store.read().workflowRuns, runId, req.studioUser.id);
  }
  @Get(":id") get(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.accessible(id, req.studioUser.id);
  }

  @Post() create(@Req() req: AuthRequest, @Body() body: unknown): WorkflowDefinition {
    const input = parseBody(definitionSchema, body);
    const stamp = new Date().toISOString();
    const workflow: WorkflowDefinition = {
      ...input,
      id: newId("workflow"),
      ownerId: req.studioUser.id,
      version: 1,
      status: "draft",
      createdAt: stamp,
      updatedAt: stamp,
    };
    this.store.update((state) => state.workflows.push(workflow));
    return workflow;
  }

  @Patch(":id") update(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = parseBody(
      definitionSchema.partial().extend({ status: z.enum(["draft", "published"]).optional() }),
      body,
    );
    return this.store.update((state) => {
      const workflow = owned(state.workflows, id, req.studioUser.id);
      const definitionChanged = Object.keys(input).some((key) => key !== "graph");
      Object.assign(workflow, input);
      if (definitionChanged) workflow.version += 1;
      workflow.updatedAt = new Date().toISOString();
      return workflow;
    });
  }

  @Post(":id/runs")
  createRun(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = parseBody(
      z.object({ inputs: z.record(z.string(), z.string()), projectId: z.string().optional() }),
      body,
    );
    const workflow = this.accessible(id, req.studioUser.id);
    if (workflow.status !== "published") throw new BadRequestException("工作流尚未发布");
    for (const field of workflow.fields) {
      if (field.required && !input.inputs[field.id]?.trim()) throw new BadRequestException(`请填写「${field.label}」`);
      const assetId = input.inputs[field.id];
      if (field.type === "asset" && assetId) owned(this.store.read().assets, assetId, req.studioUser.id);
    }
    if (input.projectId) owned(this.store.read().projects, input.projectId, req.studioUser.id);
    const stamp = new Date().toISOString();
    const definitionSnapshot = JSON.parse(
      JSON.stringify({
        title: workflow.title,
        description: workflow.description,
        fields: workflow.fields,
        stages: workflow.stages,
        version: workflow.version,
      }),
    ) as WorkflowRunRecord["definitionSnapshot"];
    const run: WorkflowRunRecord = {
      id: newId("wrun"),
      ownerId: req.studioUser.id,
      workflowId: id,
      workflowVersion: workflow.version,
      definitionSnapshot,
      projectId: input.projectId,
      inputs: input.inputs,
      status: "running",
      stages: workflow.stages.map((stage) => ({ stageId: stage.id, status: "pending", attempts: 0, assetRefs: [] })),
      currentStage: 0,
      createdAt: stamp,
      updatedAt: stamp,
    };
    this.store.update((state) => state.workflowRuns.push(run));
    return this.advance(run.id, req.studioUser.id);
  }

  @Post("runs/:runId/decide")
  decide(@Req() req: AuthRequest, @Param("runId") runId: string, @Body() body: unknown) {
    const input = parseBody(
      z.object({ action: z.enum(["approve", "retry"]), content: z.string().max(20000).optional() }),
      body,
    );
    const run = owned(this.store.read().workflowRuns, runId, req.studioUser.id);
    if (run.status !== "awaiting_review") throw new BadRequestException("当前没有待审核节点");
    if (input.action === "retry") return this.retryStage(run, run.currentStage, req.studioUser.id);
    this.store.update((state) => {
      const current = owned(state.workflowRuns, runId, req.studioUser.id);
      const stage = current.stages[current.currentStage]!;
      if (input.content !== undefined) {
        const ref = stage.assetRefs.at(-1);
        if (ref) {
          const asset = owned(state.assets, ref.assetId, req.studioUser.id);
          const version = {
            ...asset.versions.at(-1)!,
            id: newId("version"),
            content: input.content!,
            size: input.content!.length,
            createdAt: new Date().toISOString(),
          };
          asset.versions.push(version);
          stage.assetRefs.push({ assetId: asset.id, versionId: version.id });
          asset.updatedAt = version.createdAt;
        }
      }
      stage.status = "approved";
      current.currentStage += 1;
      current.status = "running";
      current.updatedAt = new Date().toISOString();
    });
    return this.advance(runId, req.studioUser.id);
  }

  @Post("runs/:runId/retry")
  retry(@Req() req: AuthRequest, @Param("runId") runId: string, @Body() body: unknown) {
    const input = parseBody(z.object({ stageId: z.string() }), body);
    const run = owned(this.store.read().workflowRuns, runId, req.studioUser.id);
    const index = run.stages.findIndex((stage) => stage.stageId === input.stageId);
    if (index < 0 || run.stages[index]?.status === "pending") throw new BadRequestException("该阶段尚未运行");
    return this.retryStage(run, index, req.studioUser.id);
  }

  @Post("runs/:runId/cancel")
  cancel(@Req() req: AuthRequest, @Param("runId") runId: string) {
    return this.store.update((state) => {
      const run = owned(state.workflowRuns, runId, req.studioUser.id);
      if (run.status === "succeeded") throw new BadRequestException("已完成的运行无法终止");
      run.status = "cancelled";
      run.updatedAt = new Date().toISOString();
      return run;
    });
  }

  private accessible(id: string, userId: string) {
    const workflow = this.store
      .read()
      .workflows.find((item) => item.id === id && (item.ownerId === userId || item.status === "published"));
    if (!workflow) throw new BadRequestException("工作流不存在");
    return workflow;
  }

  private retryStage(run: WorkflowRunRecord, index: number, userId: string) {
    this.store.update((state) => {
      const current = owned(state.workflowRuns, run.id, userId);
      current.currentStage = index;
      current.status = "running";
      current.stages.slice(index).forEach((stage) => {
        stage.status = "pending";
      });
      current.updatedAt = new Date().toISOString();
    });
    return this.advance(run.id, userId);
  }

  private advance(runId: string, userId: string): WorkflowRunRecord {
    const run = owned(this.store.read().workflowRuns, runId, userId);
    const workflow = run.definitionSnapshot ?? this.accessible(run.workflowId, userId);
    while (run.currentStage < workflow.stages.length) {
      const definition = workflow.stages[run.currentStage]!;
      const stage = run.stages[run.currentStage]!;
      const firstInput = Object.values(run.inputs).find(Boolean) || workflow.title;
      const text = `【模拟产物 · 第 ${stage.attempts + 1} 版】\n${definition.title}\n\n任务：${workflow.title}\n输入摘要：${firstInput.slice(0, 160)}\n处理方法：${definition.instruction}\n\n本阶段建议：\n1. 核实原始资料与业务目标。\n2. 用清晰结构组织可交付内容。\n3. 在审核后继续下一阶段。`;
      const previous = stage.assetRefs.at(-1);
      if (previous) {
        this.store.update((state) => {
          const asset = owned(state.assets, previous.assetId, userId);
          const version = {
            id: newId("version"),
            name: asset.name,
            mimeType: "text/plain",
            size: text.length,
            content: text,
            createdAt: new Date().toISOString(),
          };
          asset.versions.push(version);
          asset.updatedAt = version.createdAt;
          stage.assetRefs.push({ assetId: asset.id, versionId: version.id });
        });
      } else {
        const asset = this.store.createAsset({
          ownerId: userId,
          name: `${workflow.title} · ${definition.title}`,
          kind: "text",
          source: "workflow",
          sourceId: run.id,
          content: text,
        });
        stage.assetRefs.push({ assetId: asset.id, versionId: asset.versions[0]!.id });
      }
      stage.attempts += 1;
      if (definition.visibility === "review") {
        stage.status = "waiting";
        run.status = "awaiting_review";
        run.updatedAt = new Date().toISOString();
        this.store.update(() => undefined);
        return run;
      }
      stage.status = "completed";
      run.currentStage += 1;
    }
    run.status = "succeeded";
    run.updatedAt = new Date().toISOString();
    this.store.update(() => undefined);
    return run;
  }
}
