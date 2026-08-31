---
name: Expo 54 Mobile dependency alignment
description: Expo 54 dependency and Metro checks in the pnpm monorepo, including Router peer compatibility.
---

For the Mobile app on Expo SDK 54, treat `expo-doctor` and `expo install --check` as the compatibility authority. Keep Expo native packages at the exact SDK-recommended patch versions, add `expo-font` when using `@expo/vector-icons`, and keep `@babel/runtime` directly available to Mobile so pnpm resolution cannot hide it from Metro. `expo-router` may require a newer installed `@react-navigation/native` patch than the Expo package specifier suggests; a caret range such as `^7.1.8` can retain a peer-compatible 7.3.x lockfile resolution.

**Why:** pnpm's strict workspace links exposed a missing runtime helper and a Router peer mismatch that were not visible while dependencies were hoisted; Metro then failed before the app loaded.

**How to apply:** After dependency changes, run frozen installation, `expo-doctor`, `expo install --check`, TypeScript, and a web export before restarting the Mobile workflow. Treat a clean Metro startup as necessary but not sufficient proof against a native Android crash; Android device/emulator logcat is still required.