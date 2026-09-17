import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { ModelKind } from "@weavl/shared";
import { z } from "zod";
import { parseBody, type AuthRequest } from "../../common/http";
import { SessionGuard } from "../auth/session.guard";
import { MediaGenerationService } from "./media-generation.service";

const imageSchema = z.object({
  model: z.string().trim().min(1).default("gpt-image-2"),
  prompt: z.string().trim().min(1).max(5000),
  count: z.number().int().min(1).max(4).default(1),
  ratio: z.string().trim().max(20).optional(),
  size: z
    .string()
    .regex(/^\d+x\d+$/)
    .optional(),
  resolution: z.enum(["1K", "2K", "4K"]).optional(),
  quality: z.string().trim().max(30).optional(),
  referenceAssetIds: z.array(z.string().trim().min(1)).max(16).default([]),
});

const videoSchema = z.object({
  model: z.string().trim().min(1).default("doubao-seedance-2.0"),
  prompt: z.string().trim().min(1).max(5000),
  count: z.number().int().min(1).max(4).default(1),
  ratio: z.string().trim().max(20).optional(),
  resolution: z.string().trim().max(20).optional(),
  durationSeconds: z.number().int().min(1).max(30).optional(),
  generateAudio: z.boolean().optional(),
});

const modelKinds = new Set<ModelKind>(["text", "image", "video", "audio", "avatar"]);

/** 提供模型目录、同步图片生成和异步视频任务 API。 */
@Controller("studio/generations")
@UseGuards(SessionGuard)
export class MediaGenerationController {
  constructor(private readonly generation: MediaGenerationService) {}

  /**
   * 获取全部模型，或通过 kind 查询参数过滤指定生成类型。
   *
   * @param rawKind - URL 查询参数中的模型类型。
   * @returns 模型目录和渠道配置状态。
   */
  @Get("models")
  models(@Query("kind") rawKind?: string) {
    const kind = rawKind && modelKinds.has(rawKind as ModelKind) ? (rawKind as ModelKind) : undefined;
    return this.generation.models(kind);
  }

  /**
   * 校验图片参数并执行同步生成。
   *
   * @param request - 包含当前登录用户的请求对象。
   * @param body - 尚未校验的请求体。
   * @returns 图片生成结果和已持久化资产。
   */
  @Post("image")
  generateImage(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = parseBody(imageSchema, body);
    return this.generation.generateImage(request.studioUser.id, input.model, input);
  }

  /**
   * 校验视频参数并创建可持久化轮询的长任务。
   *
   * @param request - 包含当前登录用户的请求对象。
   * @param body - 尚未校验的请求体。
   * @returns 新建的视频任务视图。
   */
  @Post("video")
  submitVideo(@Req() request: AuthRequest, @Body() body: unknown) {
    const input = parseBody(videoSchema, body);
    return this.generation.submitVideo(request.studioUser.id, input.model, input);
  }

  /**
   * 查询属于当前用户的视频任务并在完成时返回生成资产。
   *
   * @param request - 包含当前登录用户的请求对象。
   * @param jobId - 平台视频任务 ID。
   * @returns 当前任务状态，完成时附带生成资产。
   */
  @Get("video/:jobId")
  pollVideo(@Req() request: AuthRequest, @Param("jobId") jobId: string) {
    return this.generation.pollVideo(request.studioUser.id, jobId);
  }
}
