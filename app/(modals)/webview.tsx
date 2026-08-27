import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export default function WebViewScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const params = useLocalSearchParams();
  
  const url = (params.url as string) || 'https://www.carrefour.fr';
  const title = (params.title as string) || 'Carrefour';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Barre de navigation */}
      <View style={styles.navbar}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => {
            if (canGoBack && webViewRef.current) {
              (webViewRef.current as any).goBack();
            } else {
              router.back();
            }
          }}
        >
          <Text style={styles.navBtnText}>←</Text>
        </TouchableOpacity>

        <View style={styles.navCenter}>
          <Text style={styles.navTitle}>{title}</Text>
          <Text style={styles.navUrl} numberOfLines={1}>{url}</Text>
        </View>

        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.navBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Barre de progression */}
      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color="#1B6CA8" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      )}

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
        }}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A3D6B',
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A3D6B',
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  navCenter: {
    flex: 1,
    alignItems: 'center',
  },
  navTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  navUrl: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 1,
  },
  loadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FAF7F0',
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#6B8FA8',
    fontWeight: '500',
  },
  webview: {
    flex: 1,
  },
});
