import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@snackflow/shared';

export interface AuthenticatedUser {
  userId: string;
  companyId: string;
  email: string;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
