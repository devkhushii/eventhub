import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import * as listingsApi from '../../api/listings';
import * as bookingsApi from '../../api/bookings';
import * as reviewsApi from '../../api/reviews';
import * as chatApi from '../../api/chat';
import Button from '../../components/Button';
import LoadingScreen from '../../components/LoadingScreen';
import ReviewCard from '../../components/ReviewCard';
import EmptyState from '../../components/EmptyState';
import colors from '../../styles/colors';
import { formatCurrency, getImageSource } from '../../utils/helpers';

const ListingDetailScreen = ({ navigation, route }) => {
  const { listingId } = route.params;
  const [listing, setListing] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const fetchListing = async () => {
    try {
      const data = await listingsApi.getListingById(listingId);
      setListing(data);
    } catch (error) {
      console.error('Failed to fetch listing:', error);
      Alert.alert('Error', 'Failed to load listing details');
    }
  };

  const fetchReviews = async () => {
    try {
      const data = await reviewsApi.getListingReviews(listingId);
      setReviews(data);
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchListing();
      await fetchReviews();
      setLoading(false);
    };
    fetchData();
  }, [listingId]);

  const handleBook = () => {
    navigation.navigate('Booking', { listing });
  };

  const handleCreateReview = () => {
    navigation.navigate('CreateReview', { listingId });
  };

  const handleChat = async () => {
    if (!listing?.vendor_id) {
      Alert.alert('Error', 'Cannot start chat');
      return;
    }
    
    setChatLoading(true);
    try {
      const chatData = await chatApi.createChat(listing.vendor_id, listing.id);
      navigation.navigate('ChatDetail', { 
        chatId: chatData.id,
        chatName: listing.title
      });
    } catch (error) {
      console.error('[Chat] Failed to create chat:', error);
      Alert.alert('Error', 'Failed to start chat');
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!listing) {
    return (
      <EmptyState
        title="Not Found"
        message="Listing not found"
      />
    );
  }

  const imageSource = getImageSource(
    listing.images?.[0]?.image_url || listing.image_url
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.imageContainer}>
          {imageSource ? (
            <Image source={imageSource} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{listing.title}</Text>
          
          {listing.location && (
            <Text style={styles.location}>📍 {listing.location}</Text>
          )}

          <Text style={styles.price}>{formatCurrency(listing.price)}</Text>

          {listing.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          )}

          {listing.listing_type && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{listing.listing_type}</Text>
            </View>
          )}

          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
              <Button
                title="Add Review"
                variant="outline"
                size="small"
                onPress={handleCreateReview}
              />
            </View>

            {reviews.length === 0 ? (
              <Text style={styles.noReviews}>No reviews yet</Text>
            ) : (
              reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomActions}>
        <TouchableOpacity 
          style={[styles.chatButton, chatLoading && styles.chatButtonDisabled]} 
          onPress={handleChat}
          disabled={chatLoading}
        >
          {chatLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Text style={styles.chatButtonIcon}>💬</Text>
              <Text style={styles.chatButtonText}>Chat</Text>
            </>
          )}
        </TouchableOpacity>
        
        <View style={styles.bookButtonContainer}>
          <Button
            title="Book Now"
            onPress={handleBook}
            loading={bookingLoading}
            style={styles.bookButton}
          />
        </View>
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
  imageContainer: {
    height: 250,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: 16,
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
  location: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 24,
  },
  badgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  reviewsSection: {
    marginTop: 16,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  noReviews: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    padding: 24,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    alignItems: 'center',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
    marginRight: 12,
    minWidth: 80,
  },
  chatButtonDisabled: {
    opacity: 0.6,
  },
  chatButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  bookButtonContainer: {
    flex: 1,
  },
  bookButton: {
    marginBottom: 0,
  },
});

export default ListingDetailScreen;
