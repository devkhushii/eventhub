import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import * as usersApi from '../../api/users';
import Input from '../../components/Input';
import Button from '../../components/Button';
import colors from '../../styles/colors';

const EditProfileScreen = ({ navigation }) => {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [errors, setErrors] = useState({});

  const handleSave = async () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await usersApi.updateCurrentUser({ full_name: name.trim(), phone });
      await refreshUser();
      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to update profile';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Input
          label="Full Name"
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          error={errors.name}
        />

        <Input
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          placeholder="Enter phone number"
          keyboardType="phone-pad"
        />

        <Button
          title="Save Changes"
          onPress={handleSave}
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
  button: {
    marginTop: 24,
  },
});

export default EditProfileScreen;