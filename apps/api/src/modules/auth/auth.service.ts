import { Injectable, UnauthorizedException } from "@nestjs/common";
import { compareSync } from "bcryptjs";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { SessionService } from "./session.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * 登录并创建会话。
   *
   * @param rawEmail - 该操作所需的业务参数。
   * @param password - 该操作所需的业务参数。
   * @returns 登录并创建会话后的结果。
   */
  async login(rawEmail: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: rawEmail.toLowerCase() } });
    if (!user || !compareSync(password, user.passwordHash)) throw new UnauthorizedException("邮箱或密码不正确");
    return { user: this.publicUser(user), session: await this.sessions.create(user.id) };
  }

  private publicUser(user: { id: string; email: string; name: string; createdAt: Date }) {
    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString() };
  }
}
