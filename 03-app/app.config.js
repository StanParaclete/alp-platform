module.exports = {
  expo: {
    name: 'ALP', slug: 'alp', version: '1.0.0', scheme: 'alp', orientation: 'default',
    userInterfaceStyle: 'automatic', icon: './assets/icon.png',
    ios: { supportsTablet: true, bundleIdentifier: 'com.growwithalp.mobile', infoPlist: { NSFaceIDUsageDescription: 'Unlock your saved ALP sign-in securely.', ITSAppUsesNonExemptEncryption: false } },
    android: { package: 'com.growwithalp.mobile', adaptiveIcon: { foregroundImage: './assets/icon.png', backgroundColor: '#F8F6FA' }, allowBackup: false },
    plugins: ['expo-router', ['expo-secure-store', { configureAndroidBackup: true, faceIDPermission: 'Unlock your saved ALP sign-in securely.' }]],
    updates: { enabled: false },
    extra: { apiUrl: process.env.EXPO_PUBLIC_API_URL || '' },
  },
};
