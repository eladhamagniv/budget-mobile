import { NativeModules, Platform } from 'react-native';

const { RootDetection } = NativeModules;

/**
 * Returns true if the device appears to be rooted.
 * Checks: test-keys build tag, su binaries, known root apps,
 * dangerous system props, writable /system partition.
 * Always returns false on non-Android platforms.
 */
export async function isDeviceRooted(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!RootDetection) return false; // module not linked (should not happen in release)
  try {
    return await RootDetection.isRooted();
  } catch {
    return false;
  }
}
