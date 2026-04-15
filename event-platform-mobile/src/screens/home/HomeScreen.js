import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import * as listingsApi from '../../api/listings';
import * as notificationsApi from '../../api/notifications';
import EmptyState from '../../components/EmptyState';
import colors from '../../styles/colors';
import { getImageSource } from '../../utils/helpers';

const CATEGORIES = [
  { id: null, name: 'All', icon: '✨' },
  { id: 'VENUE', name: 'Venues', icon: '🏠' },
  { id: 'PHOTOGRAPHER', name: 'Photo', icon: '📸' },
  { id: 'CATERER', name: 'Catering', icon: '🍽️' },
  { id: 'DJ', name: 'DJ/Music', icon: '🎵' },
  { id: 'DECORATOR', name: 'Decor', icon: '🎨' },
];

const PAGE_SIZE = 10;

const ListingCard = ({ item, onPress }) => {
  const imageSource = getImageSource(
    item.images?.[0]?.image_url || item.image_url
  );
  
  return (
    <TouchableOpacity style={styles.listingCard} onPress={() => onPress(item)} activeOpacity={0.9}>
      <View style={styles.listingImageContainer}>
        {imageSource ? (
          <Image source={imageSource} style={styles.listingImage} />
        ) : (
          <View style={styles.listingImagePlaceholder}>
            <Text style={styles.listingImagePlaceholderText}>📷</Text>
          </View>
        )}
        {item.listing_type && (
          <View style={styles.listingTypeBadge}>
            <Text style={styles.listingTypeText}>{item.listing_type}</Text>
          </View>
        )}
      </View>
      <View style={styles.listingInfo}>
        <Text style={styles.listingTitle} numberOfLines={2}>{item.title}</Text>
        {item.location && (
          <Text style={styles.listingLocation} numberOfLines={1}>📍 {item.location}</Text>
        )}
        <Text style={styles.listingPrice}>
          {item.price ? `$${item.price}` : 'Contact for price'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await notificationsApi.getUnreadCount();
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.log('Failed to fetch unread count:', error);
    }
  }, []);

  const fetchListings = async (pageNum = 0, isRefresh = false) => {
    try {
      const filters = {};
      if (searchQuery) filters.search = searchQuery;
      if (selectedCategory) filters.listing_type = selectedCategory;
      
      const res = await listingsApi.getPublishedListings(pageNum * PAGE_SIZE, PAGE_SIZE, filters);
      
      let listingsData = [];
      if (Array.isArray(res)) {
        listingsData = res;
      } else if (res?.data) {
        listingsData = Array.isArray(res.data) ? res.data : res.data?.data || [];
      } else if (res?.results) {
        listingsData = res.results;
      }
      
      if (isRefresh) {
        setListings(listingsData);
      } else {
        setListings(prev => [...prev, ...listingsData]);
      }
      setHasMore(listingsData.length === PAGE_SIZE);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchListings(0, true);
      fetchUnreadCount();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchListings(0, true);
    fetchUnreadCount();
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      fetchListings(page + 1);
    }
  };

  const handleSearch = () => {
    setLoading(true);
    fetchListings(0, true);
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setLoading(true);
    fetchListings(0, true);
  };

  const handleListingPress = (listing) => {
    navigation.navigate('ListingDetail', { listingId: listing.id });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.greetingSection}>
        <Text style={styles.greeting}>Hello, {user?.full_name?.split(' ')[0] || 'User'} 👋</Text>
        <Text style={styles.subtitle}>Find your perfect event space</Text>
      </View>
      
      <TouchableOpacity 
        style={styles.searchContainer}
        onPress={() => {}}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search listings..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); handleSearch(); }}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.notificationButton}
        onPress={() => navigation.navigate('Notifications')}
      >
        <Text style={styles.notificationIcon}>🔔</Text>
        {unreadCount > 0 && (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderCategories = () => (
    <View style={styles.categoriesSection}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
      >
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id || 'all'}
            style={[
              styles.categoryChip,
              (selectedCategory === category.id || (category.id === null && selectedCategory === null)) && 
              styles.categoryChipActive
            ]}
            onPress={() => handleCategorySelect(category.id)}
          >
            <Text style={styles.categoryIcon}>{category.icon}</Text>
            <Text style={[
              styles.categoryText,
              (selectedCategory === category.id || (category.id === null && selectedCategory === null)) && 
              styles.categoryTextActive
            ]}>{category.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderListing = ({ item }) => (
    <ListingCard item={item} onPress={handleListingPress} />
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <Text style={styles.loadingMoreText}>Loading more...</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={listings}
        renderItem={renderListing}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        ListHeaderComponent={
          <>
            {renderHeader()}
            {renderCategories()}
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Featured Listings</Text>
              <Text style={styles.sectionSubtitle}>{listings.length} available</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              title="No Listings"
              message="No listings found. Try adjusting your search."
            />
          )
        }
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    paddingTop: 16,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greetingSection: {
    marginBottom: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  clearIcon: {
    fontSize: 14,
    color: colors.textMuted,
    padding: 4,
  },
  notificationButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIcon: {
    fontSize: 20,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: colors.textLight,
    fontSize: 10,
    fontWeight: 'bold',
  },
  categoriesSection: {
    paddingVertical: 16,
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    marginRight: 10,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  categoryTextActive: {
    color: colors.textLight,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  listContent: {
    paddingBottom: 20,
  },
  listingCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  listingImageContainer: {
    height: 160,
    position: 'relative',
  },
  listingImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  listingImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listingImagePlaceholderText: {
    fontSize: 40,
  },
  listingTypeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  listingTypeText: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: '600',
  },
  listingInfo: {
    padding: 16,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  listingLocation: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  listingPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  loadingMore: {
    padding: 20,
    alignItems: 'center',
  },
  loadingMoreText: {
    color: colors.textSecondary,
  },
});

export default HomeScreen;