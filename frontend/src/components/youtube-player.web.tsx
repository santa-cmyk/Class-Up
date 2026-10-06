import { StyleSheet, View } from "react-native";
import { unstable_createElement } from "react-native-web";

/**
 * Web YouTube player rendered as a plain iframe inside a 16:9 container.
 */
export function YouTubePlayer({ videoId }: { videoId: string }) {
  const iframe = unstable_createElement("iframe", {
    src: `https://www.youtube-nocookie.com/embed/${videoId}`,
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      border: "0",
    },
    allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
    allowFullScreen: true,
    title: "YouTube video",
  });

  return (
    <View style={styles.wrap} testID="youtube-player">
      {iframe}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
});
