import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import * as vendorsApi from '../../api/vendors';
import Input from '../../components/Input';
import Button from '../../components/Button';
import colors from '../../styles/colors';

const BecomeVendorScreen = ({ navigation }) => {
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});

  const handleSubmit = async () => {
    const newErrors = {};
    if (!businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    } else if (businessName.trim().length < 2) {
      newErrors.businessName = 'Business name must be at least 2 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      business_name: businessName.trim(),
      description: description.trim() || undefined,
      vendor_type: 'manager',
    };

    setLoading(true);
    try {
      const vendorResponse = await vendorsApi.becomeVendor(payload);
      await refreshUser();
      
      const status = vendorResponse.verification_status || 'pending';
      
      if (status === 'approved') {
        Alert.alert(
          'Success!',
          'You are now a verified vendor.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert(
          'Application Submitted',
          'Your vendor application has been submitted and is pending review. You will be notified once approved.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      const message = error.response?.data?.detail || error.message || 'Failed to become vendor';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Become a Vendor</Text>
        <Text style={styles.subtitle}>
          Fill in your business details to start listing your services
        </Text>

        <Input
          label="Business Name"
          value={businessName}
          onChangeText={(text) => {
            setBusinessName(text);
            if (errors.businessName) {
              setErrors({ ...errors, businessName: null });
            }
          }}
          placeholder="Enter your business name"
          error={errors.businessName}
        />

        <Input
          label="Description (Optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your business"
          multiline
          numberOfLines={4}
        />

        <Button
          title="Submit Application"
          onPress={handleSubmit}
          loading={loading}
          style={styles.button}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  button: {
    marginTop: 24,
  },
});

export default BecomeVendorScreen;