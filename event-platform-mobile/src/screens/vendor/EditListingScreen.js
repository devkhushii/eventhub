import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import * as listingsApi from '../../api/listings';
import Input from '../../components/Input';
import Button from '../../components/Button';
import LoadingScreen from '../../components/LoadingScreen';
import colors from '../../styles/colors';

const EditListingScreen = ({ navigation, route }) => {
  const { listingId } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [listingType, setListingType] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchListing();
  }, [listingId]);

  const fetchListing = async () => {
    try {
      const data = await listingsApi.getListingById(listingId);
      setTitle(data.title || '');
      setDescription(data.description || '');
      setPrice(data.price?.toString() || '');
      setLocation(data.location || '');
      setListingType(data.listing_type || '');
    } catch (error) {
      Alert.alert('Error', 'Failed to load listing');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!price) newErrors.price = 'Price is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      await listingsApi.updateListing(listingId, {
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        location: location.trim(),
        listing_type: listingType,
      });
      Alert.alert('Success', 'Listing updated successfully');
      navigation.goBack();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to update listing';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Input
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Enter listing title"
          error={errors.title}
        />

        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Enter description"
          multiline
          numberOfLines={4}
        />

        <Input
          label="Price"
          value={price}
          onChangeText={setPrice}
          placeholder="Enter price"
          keyboardType="numeric"
          error={errors.price}
        />

        <Input
          label="Location"
          value={location}
          onChangeText={setLocation}
          placeholder="Enter location"
        />

        <Input
          label="Listing Type"
          value={listingType}
          onChangeText={setListingType}
          placeholder="event_space, equipment, or catering"
        />

        <Button
          title="Save Changes"
          onPress={handleSave}
          loading={saving}
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

export default EditListingScreen;
