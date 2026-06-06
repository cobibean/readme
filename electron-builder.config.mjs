export default {
  appId: 'app.readme.desktop',
  productName: 'readme',
  directories: {
    output: 'release'
  },
  files: ['dist/**/*', 'package.json'],
  extraResources: [
    {
      from: 'dist/native',
      to: 'native',
      filter: ['longread-keychain']
    },
    {
      from: 'node_modules/ffmpeg-static',
      to: 'ffmpeg-static',
      filter: ['**/*']
    }
  ],
  mac: {
    category: 'public.app-category.productivity',
    hardenedRuntime: true,
    icon: 'build/icon.icns',
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.inherit.plist',
    gatekeeperAssess: false,
    strictVerify: true,
    notarize: true,
    extendInfo: {
      NSAudioCaptureUsageDescription: null,
      NSBluetoothAlwaysUsageDescription: null,
      NSBluetoothPeripheralUsageDescription: null,
      NSCameraUsageDescription: null,
      NSMicrophoneUsageDescription: null
    },
    binaries: ['Contents/Resources/ffmpeg-static/ffmpeg', 'Contents/Resources/native/longread-keychain'],
    target: ['dmg']
  },
  dmg: {
    sign: false,
    contents: [
      {
        x: 180,
        y: 170,
        type: 'file'
      },
      {
        x: 420,
        y: 170,
        type: 'link',
        path: '/Applications'
      }
    ]
  }
};
