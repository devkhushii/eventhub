import React from 'react';
import { View, Text, StyleSheet, Alert, Linking, TouchableOpacity } from 'react-native';
import Button from '../../components/Button';
import colors from '../../styles/colors';

const VerifyEmailScreen = ({ navigation }) => {
  const handleOpenEmail = () => {
    Linking.openURL('mailto:');
  };

  const handleGoToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.message}>
          We've sent a verification link to your email address. Please check your inbox and click the link to verify your account.
        </Text>
        
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📧</Text>
        </View>

        <Button
          title="Open Email App"
          onPress={handleOpenEmail}
          style={styles.button}
        />

        <TouchableOpacity
          onPress={handleGoToLogin}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  icon: {
    fontSize: 40,
  },
  button: {
    width: '100%',
    marginBottom: 16,
  },
  linkButton: {
    padding: 12,
  },
  linkText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VerifyEmailScreen;