import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { Permission } from '@snackflow/shared';

export const PERMISSIONS_KEY = 'permissions';
export const IS_PUBLIC_KEY = 'isPublic';

export const RequirePermission = (...permissions: Permission[]): CustomDecorator<string> =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);
