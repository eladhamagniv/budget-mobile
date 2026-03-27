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
  if (!RootDetection) return false;
  try {
    return await RootDetection.isRooted();
  } catch {
    return false;
  }
}

/**
 * Returns true if a dynamic instrumentation or hooking framework is detected
 * (Frida, Xposed, Cydia Substrate, RootCloak, or a debugger attached).
 */
export async function isDeviceTampered(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!RootDetection) return false;
  try {
    return await RootDetection.isTampered();
  } catch {
    return false;
  }
}

/**
 * Returns true if the app appears to be running in an emulator.
 * Uses a scoring system (3+ indicators required) to reduce false positives.
 */
export async function isEmulator(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!RootDetection) return false;
  try {
    return await RootDetection.isEmulator();
  } catch {
    return false;
  }
}

/**
 * Full security check — returns true if ANY threat is detected.
 * Combines root, tamper, and emulator checks.
 */
export async function isDeviceCompromised(): Promise<boolean> {
  const [rooted, tampered, emulator] = await Promise.all([
    isDeviceRooted(),
    isDeviceTampered(),
    isEmulator(),
  ]);
  return rooted || tampered || emulator;
}
