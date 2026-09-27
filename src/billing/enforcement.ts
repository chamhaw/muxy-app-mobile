import { Platform, type PlatformOSType } from 'react-native';

export function isBillingEnforced(_platform: PlatformOSType = Platform.OS, _dev: boolean = __DEV__): boolean {
  return false;
}
