import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle } from 'react-native';
import { COLORS } from '../utils/constants';

interface TimerProps {
  seconds: number;
  maxSeconds: number;
  size?: number;
  style?: ViewStyle;
  onExpire?: () => void;
}

export default function Timer({
  seconds,
  maxSeconds,
  size = 44,
  style,
  onExpire,
}: TimerProps) {
  const animatedValue = useRef(new Animated.Value(seconds / maxSeconds)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: seconds / maxSeconds,
      duration: 300,
      useNativeDriver: false,
    }).start();

    if (seconds === 0 && onExpire) {
      onExpire();
    }
  }, [seconds]);

  // Interpolate color from green -> yellow -> red
  const progress = seconds / maxSeconds;
  let timerColor = COLORS.timerNormal;
  if (progress < 0.2) {
    timerColor = COLORS.timerDanger;
  } else if (progress < 0.4) {
    timerColor = COLORS.timerWarning;
  }

  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Background circle */}
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: COLORS.border,
          },
        ]}
      />

      {/* Progress arc (using border approach for simplicity) */}
      <View
        style={[
          styles.progressCircle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: timerColor,
            opacity: progress,
          },
        ]}
      />

      {/* Seconds text */}
      <View style={styles.textContainer}>
        <Text
          style={[
            styles.secondsText,
            { color: timerColor, fontSize: size * 0.3 },
          ]}
        >
          {seconds}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  circle: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  progressCircle: {
    position: 'absolute',
  },
  textContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondsText: {
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
