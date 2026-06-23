import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
  ScrollView,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import * as listingsApi from '../../api/listings';
import * as notificationsApi from '../../api/notifications';
import EmptyState from '../../components/EmptyState';
import colors from '../../styles/colors';
import { getImageSource } from '../../utils/helpers';

const CATEGORIES = [
  { id: null, name: 'All', icon: 'star' },
  { id: 'VENUE', name: 'Venues', icon: 'home' },
  { id: 'PHOTOGRAPHER', name: 'Photo', icon: 'camera' },
  { id: 'CATERER', name: 'Catering', icon: 'utensils' },
  { id: 'DJ', name: 'DJ/Music', icon: 'music' },
  { id: 'DECORATOR', name: 'Decor', icon: 'paint-brush' },
];

const PAGE_SIZE = 10;

const ListingCard = ({ item, onPress }) => {
  const imageSource = getImageSource(
    item.images?.[0]?.image_url || item.image_url
  );
  
  return (
    <TouchableOpacity className="mx-5 mb-4 bg-white rounded-2xl overflow-hidden shadow-sm" onPress={() => onPress(item)} activeOpacity={0.9} style={{ elevation: 2 }}>
      <View className="h-40 relative">
        {imageSource ? (
          <Image source={imageSource} className="w-full h-full" style={{ resizeMode: 'cover' }} />
        ) : (
          <View className="w-full h-full bg-slate-100 items-center justify-center">
            <FontAwesome5 name="camera" size={32} color="#94a3b8" />
          </View>
        )}
        {item.listing_type && (
          <View className="absolute top-3 left-3 bg-[#FE424D] px-3 py-1.5 rounded-full">
            <Text className="text-white text-xs font-semibold">{item.listing_type}</Text>
          </View>
        )}
      </View>
      <View className="p-4">
        <Text className="text-base font-semibold text-slate-900 mb-1" numberOfLines={2}>{item.title}</Text>
        {item.location && (
          <View className="flex-row items-center mb-2">
            <FontAwesome5 name="map-marker-alt" size={12} color="#64748b" />
            <Text className="text-sm text-slate-500 ml-1" numberOfLines={1}>{item.location}</Text>
          </View>
        )}
        <Text className="text-lg font-bold text-green-600">
          {item.price ? `₹${item.price}` : 'Contact for price'}
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
    <View className="p-5 pt-4 bg-white rounded-b-3xl" style={{ elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }}>
      <View className="mb-4">
        <View className="flex-row items-center">
          <Text className="text-3xl font-bold text-slate-900 mr-2">Hello, {user?.full_name?.split(' ')[0] || 'User'}</Text>
          <FontAwesome5 name="hand-paper" size={24} color="#fbbf24" solid />
        </View>
        <Text className="text-sm text-slate-500 mt-1">Find your perfect event space</Text>
      </View>
      
      <TouchableOpacity 
        className="flex-row items-center bg-slate-100 rounded-2xl px-4 py-3"
        onPress={() => {}}
      >
        <FontAwesome5 name="search" size={16} color="#64748b" style={{ marginRight: 8 }} />
        <TextInput
          className="flex-1 text-base text-slate-900"
          placeholder="Search listings..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); handleSearch(); }} className="p-1">
            <FontAwesome5 name="times" size={14} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        className="absolute top-5 right-5 w-11 h-11 rounded-full bg-slate-100 items-center justify-center"
        onPress={() => navigation.navigate('Notifications')}
      >
        <FontAwesome5 name="bell" size={20} color="#64748b" solid />
        {unreadCount > 0 && (
          <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
            <Text className="text-white text-[10px] font-bold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderCategories = () => (
    <View className="py-4">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
      >
        {CATEGORIES.map((category) => {
          const isActive = selectedCategory === category.id || (category.id === null && selectedCategory === null);
          return (
            <TouchableOpacity
              key={category.id || 'all'}
              className={`flex-row items-center px-4 py-2.5 rounded-full mr-2.5 ${isActive ? 'bg-[#FE424D]' : 'bg-white'}`}
              onPress={() => handleCategorySelect(category.id)}
              style={!isActive ? { borderWidth: 1, borderColor: '#e2e8f0' } : {}}
            >
              <FontAwesome5 name={category.icon} size={14} color={isActive ? '#ffffff' : '#64748b'} style={{ marginRight: 6 }} solid />
              <Text className={`text-sm font-medium ${isActive ? 'text-white' : 'text-slate-600'}`}>
                {category.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderListing = ({ item }) => (
    <ListingCard item={item} onPress={handleListingPress} />
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View className="p-5 items-center">
        <Text className="text-slate-500">Loading more...</Text>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <FlatList
        data={listings}
        renderItem={renderListing}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        ListHeaderComponent={
          <>
            {renderHeader()}
            {renderCategories()}
            <View className="flex-row justify-between items-center px-5 py-3">
              <Text className="text-xl font-bold text-slate-900">Featured Listings</Text>
              <Text className="text-sm text-slate-500">{listings.length} available</Text>
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
        contentContainerStyle={{ paddingBottom: 20 }}
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
    </SafeAreaView>
  );
};

export default HomeScreen;