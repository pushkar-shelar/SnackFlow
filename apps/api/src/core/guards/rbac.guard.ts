import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, hasPermission } from '@snackflow/shared';
import { PERMISSIONS_KEY, IS_PUBLIC_KEY } from '../decorators/require-permission.decorator.js';
import { AuthenticatedUser } from '../decorators/current-user.decorator.js';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Default Deny Rule: If route has no permissions defined, reject immediately!
    if (!requiredPermissions || requiredPermissions.length === 0) {
      throw new ForbiddenException(
        'Access denied: endpoint lacks explicit @RequirePermission decorator (Default Deny)',
      );
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user || !user.role) {
      throw new UnauthorizedException('Authentication required for RBAC evaluation');
    }

    const hasAny = requiredPermissions.some((permission) =>
      hasPermission(user.role, permission),
    );

    if (!hasAny) {
      throw new ForbiddenException(
        `Access forbidden: Role '${user.role}' lacks required permission '${requiredPermissions[0]}'`,
      );
    }

    return true;
  }
}
