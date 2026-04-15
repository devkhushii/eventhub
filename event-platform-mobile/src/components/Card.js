import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, shadows, borderRadius } from '../styles/colors';

const Card = ({ 
  children, 
  onPress, 
  style, 
  variant = 'elevated',
  padding = true,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'flat':
        return {
          shadowColor: 'transparent',
          elevation: 0,
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'outlined':
        return {
          shadowColor: 'transparent',
          elevation: 0,
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'elevated':
      default:
        return shadows.medium;
    }
  };

  const CardWrapper = onPress ? TouchableOpacity : View;

  return (
    <CardWrapper
      onPress={onPress}
      style={[
        styles.card,
        getVariantStyles(),
        padding && styles.padding,
        style,
      ]}
      activeOpacity={onPress ? 0.9 : 1}
    >
      {children}
    </CardWrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  padding: {
    padding: 16,
  },
});

export default Card;