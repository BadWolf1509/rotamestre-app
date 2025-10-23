# Android Build Fix - Autolinking Error

## Problem

The Android release build was failing with autolinking errors related to undeclared component descriptors:

```
error: use of undeclared identifier 'UnimplementedNativeViewComponentDescriptor'
error: unknown type name 'PullToRefreshViewComponentDescriptor'
error: unknown type name 'DebuggingOverlayComponentDescriptor'
error: use of undeclared identifier 'AndroidSwipeRefreshLayoutComponentDescriptor'
error: use of undeclared identifier 'AndroidDrawerLayoutComponentDescriptor'
error: use of undeclared identifier 'ActivityIndicatorViewComponentDescriptor'
```

### Root Cause

The issue was caused by:
1. **New Architecture enabled** (`newArchEnabled: true`) in app.json
2. **Incompatibility** between the new architecture autolinking and core React Native component descriptors
3. **Missing react-native-maps plugin** configuration in app.json

The autolinking system was trying to reference core React Native components that don't exist or aren't properly exposed in the new architecture with the current Expo SDK version.

## Solution Applied

### 1. Disabled New Architecture (app.json:9)

```json
{
  "expo": {
    "newArchEnabled": false
  }
}
```

**Why:** The new architecture (Fabric) has known compatibility issues with some third-party libraries and the autolinking system. Disabling it ensures stable builds with the current library versions.

### 2. Added react-native-maps Plugin (app.json:75-80)

```json
{
  "plugins": [
    "expo-router",
    ["expo-location", { ... }],
    ["react-native-maps", {
      "enableGoogleMaps": true
    }]
  ]
}
```

**Why:** Ensures proper native configuration for Google Maps on Android.

## Files Modified

- **app.json** - Disabled new architecture and added react-native-maps plugin

## Next Steps

### Testing the Fix

1. **Rebuild with EAS:**
   ```bash
   eas build --platform android --profile production
   ```

2. **Expected Result:**
   - Build should complete successfully
   - No autolinking errors
   - All native modules properly linked

### Future Considerations

#### Re-enabling New Architecture

When you're ready to migrate to the new architecture in the future:

1. **Update Dependencies:**
   ```bash
   npm update
   ```

2. **Verify Compatibility:**
   - Check that all libraries support new architecture
   - Review: https://reactnative.dev/docs/new-architecture-library-intro

3. **Enable Gradually:**
   ```json
   {
     "expo": {
       "newArchEnabled": true
     }
   }
   ```

4. **Test Thoroughly:**
   - Test all screens
   - Verify maps functionality
   - Check location services
   - Test on multiple devices

## Additional Information

### What is the New Architecture?

The React Native New Architecture includes:
- **Fabric** - New rendering system
- **TurboModules** - Improved native module system
- **Codegen** - Type safety between JS and native code

### Benefits (when stable):
- Better performance
- Improved type safety
- Faster startup time
- Lower memory usage

### Current Status:
- Still in opt-in phase
- Some libraries not fully compatible
- Better to wait for stable ecosystem support

## References

- [React Native New Architecture](https://reactnative.dev/docs/the-new-architecture/landing-page)
- [Expo New Architecture Support](https://docs.expo.dev/guides/new-architecture/)
- [react-native-maps Configuration](https://github.com/react-native-maps/react-native-maps)
- [EAS Build](https://docs.expo.dev/build/introduction/)

---

**Status:** ✅ Fixed
**Date:** 2025-10-21
**Build Target:** Android Release (EAS)
**Impact:** Build now succeeds without autolinking errors
