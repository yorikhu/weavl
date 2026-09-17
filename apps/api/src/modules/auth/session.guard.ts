import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthRequest, sessionToken } from "../../common/http";
import { SessionService } from "./session.service";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  /**
   * 校验请求会话。
   *
   * @param context - NestJS 请求执行上下文。
   * @returns 校验请求会话后的结果。
   */
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = sessionToken(request);
    const user = await this.sessions.userFromToken(token);
    if (!user || !token) throw new UnauthorizedException("请先登录");
    request.studioUser = user;
    request.sessionToken = token;
    return true;
  }
}
