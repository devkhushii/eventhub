import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as listingsApi from '../../api/listings';
import Button from '../../components/Button';
import Card from '../../components/Card';
import colors from '../../styles/colors';

const UploadImagesScreen = ({ navigation, route }) => {
  const { listingId } = route.params;
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to upload images.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newImage = {
          uri: result.assets[0].uri,
          width: result.assets[0].width,
          height: result.assets[0].height,
        };
        setImages(prev => [...prev, newImage]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your camera to take photos.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newImage = {
          uri: result.assets[0].uri,
          width: result.assets[0].width,
          height: result.assets[0].height,
        };
        setImages(prev => [...prev, newImage]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (images.length === 0) {
      Alert.alert('No Images', 'Please add at least one image to upload.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const imageUris = images.map(img => img.uri);
      
      console.log('[UploadImages] Uploading', imageUris.length, 'images...');
      
      const result = await listingsApi.uploadListingImages(listingId, imageUris);
      
      console.log('[UploadImages] Upload success:', result);
      
      Alert.alert(
        'Success!',
        `${images.length} image(s) uploaded successfully`,
        [
          {
            text: 'View Listing',
            onPress: () => navigation.navigate('MyListings'),
          },
        ]
      );
    } catch (error) {
      console.error('[UploadImages] Upload error:', error.response?.data || error.message);
      const message = error.response?.data?.detail || error.message || 'Failed to upload images';
      Alert.alert('Upload Failed', message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const showImageSourceOptions = () => {
    Alert.alert(
      'Add Image',
      'Choose an option',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Photo Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.title}>Upload Images</Text>
          <Text style={styles.subtitle}>
            Add up to 10 images for your listing
          </Text>

          <Card style={styles.infoCard}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>
              High-quality images help attract more customers. Add a cover photo first, then additional photos.
            </Text>
          </Card>

          {images.length > 0 && (
            <View style={styles.imageGrid}>
              {images.map((img, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri: img.uri }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeImage(index)}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                  {index === 0 && (
                    <View style={styles.coverBadge}>
                      <Text style={styles.coverBadgeText}>Cover</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {images.length < 10 && (
            <TouchableOpacity style={styles.addButton} onPress={showImageSourceOptions}>
              <Text style={styles.addButtonIcon}>+</Text>
              <Text style={styles.addButtonText}>Add Image</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.imageCount}>
            {images.length} / 10 images added
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {uploading ? (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        ) : (
          <Button
            title="Upload Images"
            onPress={handleUpload}
            disabled={images.length === 0}
            style={styles.uploadButton}
          />
        )}
      </View>
    </View>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 20,
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  imageWrapper: {
    width: '31%',
    aspectRatio: 1,
    marginRight: '2%',
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: 'bold',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  coverBadgeText: {
    color: colors.textLight,
    fontSize: 10,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    marginBottom: 12,
  },
  addButtonIcon: {
    fontSize: 24,
    color: colors.primary,
    marginRight: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  imageCount: {
    textAlign: 'center',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  footer: {
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  uploadButton: {
    width: '100%',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
  },
  uploadingText: {
    marginLeft: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
});

export default UploadImagesScreen;