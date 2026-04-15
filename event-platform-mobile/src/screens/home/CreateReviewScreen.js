import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import * as reviewsApi from '../../api/reviews';
import Input from '../../components/Input';
import Button from '../../components/Button';
import colors from '../../styles/colors';

const CreateReviewScreen = ({ navigation, route }) => {
  const { listingId } = route.params;
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleSubmit = async () => {
    const newErrors = {};
    if (!rating) newErrors.rating = 'Rating is required';
    if (parseInt(rating) < 1 || parseInt(rating) > 5) {
      newErrors.rating = 'Rating must be between 1 and 5';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await reviewsApi.createReview({
        listing_id: listingId,
        rating: parseInt(rating),
        comment: comment.trim(),
      });
      Alert.alert('Success', 'Review submitted successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to submit review';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Write a Review</Text>

        <Input
          label="Rating (1-5)"
          value={rating}
          onChangeText={setRating}
          placeholder="Enter rating (1-5)"
          keyboardType="numeric"
          error={errors.rating}
        />

        <Input
          label="Comment"
          value={comment}
          onChangeText={setComment}
          placeholder="Share your experience..."
          multiline
          numberOfLines={4}
        />

        <Button
          title="Submit Review"
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
    marginBottom: 24,
  },
  button: {
    marginTop: 24,
  },
});

export default CreateReviewScreen;
