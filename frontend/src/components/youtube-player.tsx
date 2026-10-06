import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Native YouTube player (iOS/Android) via WebView with the official
 * youtube-nocookie embed endpoint.
 */
export function YouTubePlayer({ videoId }: { videoId: string }) {
  return (
    <View style={styles.wrap} testID="youtube-player">
      <WebView
        style={styles.webview}
        javaScriptEnabled
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        source={{ uri: `https://www.youtube-nocookie.com/embed/${videoId}` }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", aspectRatio: 16 / 9, borderRadius: 16, overflow: "hidden", backgroundColor: "#000" },
  webview: { flex: 1, backgroundColor: "#000" },
});
