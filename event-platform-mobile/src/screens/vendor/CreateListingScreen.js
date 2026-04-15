import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as listingsApi from '../../api/listings';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Card from '../../components/Card';
import colors from '../../styles/colors';

const LISTING_TYPES = [
  { value: 'VENUE', label: 'Venue', icon: '🏠' },
  { value: 'DJ', label: 'DJ/Music', icon: '🎵' },
  { value: 'CATERER', label: 'Catering', icon: '🍽️' },
  { value: 'DECORATOR', label: 'Decorator', icon: '🎨' },
  { value: 'PHOTOGRAPHER', label: 'Photographer', icon: '📸' },
  { value: 'EVENT_MANAGER', label: 'Event Manager', icon: '📋' },
  { value: 'OTHER', label: 'Other', icon: '✨' },
];

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', description: 'Save as draft' },
  { value: 'PUBLISHED', label: 'Publish', description: 'Make visible to users' },
];

const CreateListingScreen = ({ navigation }) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    listing_type: 'VENUE',
    price: '',
    location: '',
    status: 'DRAFT',
    details: {},
  });
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.title.trim()) newErrors.title = 'Title is required';
    if (!form.price || isNaN(Number(form.price))) newErrors.price = 'Valid price is required';
    if (!form.listing_type) newErrors.listing_type = 'Listing type is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description?.trim() || '',
        listing_type: form.listing_type,
        price: Number(form.price),
        location: form.location?.trim() || '',
        details: form.details || {},
        status: form.status,
      };

      console.log('[CreateListing] Payload:', JSON.stringify(payload));
      
      const data = await listingsApi.createListing(payload);
      Alert.alert(
        'Success!', 
        'Listing created successfully',
        [
          {
            text: 'Add Images',
            onPress: () => navigation.navigate('UploadImages', { listingId: data.id }),
          },
          {
            text: 'Later',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('[CreateListing] Error:', error.response?.data);
      const message = error.response?.data?.detail || error.message || 'Failed to create listing';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const selectedType = LISTING_TYPES.find(t => t.value === form.listing_type);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <Card style={styles.card}>
            <Input
              label="Listing Title"
              value={form.title}
              onChangeText={(value) => updateForm('title', value)}
              placeholder="Enter a catchy title"
              error={errors.title}
            />

            <View style={styles.inputSpacer} />

            <Input
              label="Description"
              value={form.description}
              onChangeText={(value) => updateForm('description', value)}
              placeholder="Describe your service..."
              multiline
              numberOfLines={4}
            />
          </Card>

          <Text style={styles.sectionTitle}>Listing Type</Text>
          
          <Card style={styles.card}>
            <TouchableOpacity 
              style={styles.dropdown}
              onPress={() => setShowTypePicker(!showTypePicker)}
            >
              <View style={styles.dropdownContent}>
                <Text style={styles.dropdownIcon}>{selectedType?.icon}</Text>
                <Text style={styles.dropdownText}>{selectedType?.label}</Text>
              </View>
              <Text style={styles.dropdownArrow}>{showTypePicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showTypePicker && (
              <View style={styles.pickerContainer}>
                {LISTING_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.pickerOption,
                      form.listing_type === type.value && styles.pickerOptionActive,
                    ]}
                    onPress={() => {
                      updateForm('listing_type', type.value);
                      setShowTypePicker(false);
                    }}
                  >
                    <Text style={styles.pickerIcon}>{type.icon}</Text>
                    <Text style={[
                      styles.pickerText,
                      form.listing_type === type.value && styles.pickerTextActive,
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card>

          <Text style={styles.sectionTitle}>Pricing & Location</Text>
          
          <Card style={styles.card}>
            <Input
              label="Price ($)"
              value={form.price}
              onChangeText={(value) => updateForm('price', value)}
              placeholder="0.00"
              keyboardType="numeric"
              error={errors.price}
            />

            <View style={styles.inputSpacer} />

            <Input
              label="Location"
              value={form.location}
              onChangeText={(value) => updateForm('location', value)}
              placeholder="City, State"
            />
          </Card>

          <Text style={styles.sectionTitle}>Visibility</Text>
          
          <Card style={styles.card}>
            <Text style={styles.toggleLabel}>Status</Text>
            <View style={styles.toggleContainer}>
              {STATUS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.toggleButton,
                    form.status === option.value && styles.toggleButtonActive,
                  ]}
                  onPress={() => updateForm('status', option.value)}
                >
                  <Text style={[
                    styles.toggleText,
                    form.status === option.value && styles.toggleTextActive,
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={[
                    styles.toggleDescription,
                    form.status === option.value && styles.toggleDescriptionActive,
                  ]}>
                    {option.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          <Button
            title="Create Listing"
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitButton}
          />

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  card: {
    padding: 16,
    borderRadius: 16,
  },
  inputSpacer: {
    height: 16,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  dropdownArrow: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pickerContainer: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pickerOptionActive: {
    backgroundColor: colors.primary + '15',
  },
  pickerIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  pickerText: {
    fontSize: 15,
    color: colors.text,
  },
  pickerTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  toggleButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  toggleTextActive: {
    color: colors.primary,
  },
  toggleDescription: {
    fontSize: 12,
    color: colors.textMuted,
  },
  toggleDescriptionActive: {
    color: colors.primary,
  },
  submitButton: {
    marginTop: 32,
  },
  bottomSpacer: {
    height: 40,
  },
});

export default CreateListingScreen;