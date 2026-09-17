import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthRequest, parseBody } from "../../common/http";
import { SessionGuard } from "../auth/session.guard";
import { WorkflowsService } from "./workflows.service";
const field = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "select", "asset"]),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});
const stage = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  instruction: z.string(),
  outputKind: z.enum(["text", "image", "video", "audio", "pdf", "word", "ppt", "file"]),
  visibility: z.enum(["hidden", "summary", "preview", "review"]),
});
const definition = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().max(800),
  category: z.string().max(80),
  fields: z.array(field),
  stages: z.array(stage).min(1),
  graph: z.record(z.string(), z.unknown()).optional(),
});
@Controller("studio/workflows")
@UseGuards(SessionGuard)
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}
  /**
   * 读取工作流列表。
   *
   * @param r - 该操作所需的业务参数。
   * @returns 读取工作流列表后的结果。
   */
  @Get() list(@Req() r: AuthRequest) {
    return this.workflows.list(r.studioUser.id);
  }
  /**
   * 读取工作流运行列表。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @returns 读取工作流运行列表后的结果。
   */
  @Get("runs") runs(@Req() r: AuthRequest, @Query("workflowId") id?: string) {
    return this.workflows.runs(r.studioUser.id, id);
  }
  /**
   * 读取工作流运行详情。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @returns 读取工作流运行详情后的结果。
   */
  @Get("runs/:runId") run(@Req() r: AuthRequest, @Param("runId") id: string) {
    return this.workflows.run(id, r.studioUser.id);
  }
  /**
   * 读取工作流详情。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @returns 读取工作流详情后的结果。
   */
  @Get(":id") get(@Req() r: AuthRequest, @Param("id") id: string) {
    return this.workflows.get(id, r.studioUser.id);
  }
  /**
   * 创建工作流。
   *
   * @param r - 该操作所需的业务参数。
   * @param b - 该操作所需的业务参数。
   * @returns 创建工作流后的结果。
   */
  @Post() create(@Req() r: AuthRequest, @Body() b: unknown) {
    return this.workflows.create(r.studioUser.id, parseBody(definition, b));
  }
  /**
   * 更新工作流。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @param b - 该操作所需的业务参数。
   * @returns 更新工作流后的结果。
   */
  @Patch(":id") update(@Req() r: AuthRequest, @Param("id") id: string, @Body() b: unknown) {
    return this.workflows.update(
      id,
      r.studioUser.id,
      parseBody(definition.partial().extend({ status: z.enum(["draft", "published"]).optional() }), b),
    );
  }
  /**
   * 创建工作流运行。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @param b - 该操作所需的业务参数。
   * @returns 创建工作流运行后的结果。
   */
  @Post(":id/runs") createRun(@Req() r: AuthRequest, @Param("id") id: string, @Body() b: unknown) {
    const x = parseBody(z.object({ inputs: z.record(z.string(), z.string()), projectId: z.string().optional() }), b);
    return this.workflows.createRun(id, r.studioUser.id, x);
  }
  /**
   * 提交确认门决策。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @param b - 该操作所需的业务参数。
   * @returns 提交确认门决策后的结果。
   */
  @Post("runs/:runId/decide") decide(@Req() r: AuthRequest, @Param("runId") id: string, @Body() b: unknown) {
    const x = parseBody(
      z.object({ action: z.enum(["approve", "retry"]), content: z.string().max(20000).optional() }),
      b,
    );
    return this.workflows.decide(id, r.studioUser.id, x.action, x.content);
  }
  /**
   * 重试工作流阶段。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @param b - 该操作所需的业务参数。
   * @returns 重试工作流阶段后的结果。
   */
  @Post("runs/:runId/retry") retry(@Req() r: AuthRequest, @Param("runId") id: string, @Body() b: unknown) {
    const x = parseBody(z.object({ stageId: z.string() }), b);
    return this.workflows.retry(id, r.studioUser.id, x.stageId);
  }
  /**
   * 取消工作流运行。
   *
   * @param r - 该操作所需的业务参数。
   * @param id - 资源标识。
   * @returns 取消工作流运行后的结果。
   */
  @Post("runs/:runId/cancel") cancel(@Req() r: AuthRequest, @Param("runId") id: string) {
    return this.workflows.cancel(id, r.studioUser.id);
  }
}
