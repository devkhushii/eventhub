import { StyleSheet, Platform } from 'react-native';

const fontFamily = Platform.OS === 'ios' ? 'System' : 'Roboto';

export const typography = StyleSheet.create({
  h1: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontFamily,
  },
  h2: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontFamily,
  },
  h3: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.2,
    fontFamily,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    fontFamily,
  },
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    fontFamily,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    fontFamily,
  },
  bodySmallMedium: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    fontFamily,
  },
  captionMedium: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    fontFamily,
  },
  button: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily,
  },
  buttonSmall: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily,
  },
  overline: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily,
  },
});

export default typography;
