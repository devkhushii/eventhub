import React, { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { navigationRef, onNavigationReady } from '../utils/navigationService';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import ListingDetailScreen from '../screens/home/ListingDetailScreen';
import CreateReviewScreen from '../screens/home/CreateReviewScreen';
import CreateBookingScreen from '../screens/home/CreateBookingScreen';
import BecomeVendorScreen from '../screens/profile/BecomeVendorScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import BookingDetailScreen from '../screens/bookings/BookingDetailScreen';
import ReviewsScreen from '../screens/reviews/ReviewsScreen';
import PaymentScreen from '../screens/payments/PaymentScreen';
import PaymentHistoryScreen from '../screens/payments/PaymentHistoryScreen';
import ChatDetailScreen from '../screens/chat/ChatDetailScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import colors from '../styles/colors';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { isAuthenticated, loading, user } = useAuth();

  console.log('[AppNavigator] Render — isAuthenticated:', isAuthenticated, 'loading:', loading, 'role:', user?.role);

  // BUG FIX: NavigationContainer.onReady fires too early on cold start (during AuthNavigator)
  // Re-flush the queue when the user is fully authenticated and MainTabNavigator is mounted.
  useEffect(() => {
    if (isAuthenticated) {
      console.log('[AppNavigator] Authenticated state reached, flushing navigation queue...');
      // Small delay to ensure Stack.Navigator has rendered the nested screens
      setTimeout(() => {
        onNavigationReady();
      }, 100);
    }
  }, [isAuthenticated]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        console.log('[AppNavigator] NavigationContainer onReady fired');
        onNavigationReady();
      }}
      onStateChange={(state) => {
        const currentRoute = state?.routes?.[state.index];
        console.log('[AppNavigator] Navigation state changed:', currentRoute?.name, JSON.stringify(currentRoute?.params || {}).slice(0, 100));
      }}
    >
      {isAuthenticated ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen 
            name="ListingDetail" 
            component={ListingDetailScreen}
            options={{ 
              headerShown: true, 
              title: 'Details',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
            }}
          />
          <Stack.Screen 
            name="CreateReview" 
            component={CreateReviewScreen}
            options={{ 
              headerShown: true, 
              title: 'Write Review',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
            }}
          />
          <Stack.Screen 
            name="Booking" 
            component={CreateBookingScreen}
            options={{ 
              headerShown: true, 
              title: 'Book Listing',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
            }}
          />
          <Stack.Screen 
            name="Notifications" 
            component={NotificationsScreen}
            options={{ 
              headerShown: true, 
              title: 'Notifications',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
            }}
          />
          <Stack.Screen 
            name="BecomeVendor" 
            component={BecomeVendorScreen}
            options={{ 
              headerShown: true, 
              title: 'Become Vendor',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
            }}
          />
          <Stack.Screen 
            name="EditProfile" 
            component={EditProfileScreen}
            options={{ 
              headerShown: true, 
              title: 'Edit Profile',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
            }}
          />
          <Stack.Screen 
            name="BookingDetail" 
            component={BookingDetailScreen}
            options={{ 
              headerShown: true, 
              title: 'Booking Details',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
            }}
          />
          <Stack.Screen 
            name="Reviews" 
            component={ReviewsScreen}
            options={{ 
              headerShown: true, 
              title: 'Reviews',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
            }}
          />
          <Stack.Screen 
            name="Payment" 
            component={PaymentScreen}
            options={{ 
              headerShown: true, 
              title: 'Payment',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
            }}
          />
          <Stack.Screen 
            name="PaymentHistory" 
            component={PaymentHistoryScreen}
            options={{ 
              headerShown: true, 
              title: 'Payment History',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
            }}
          />
          <Stack.Screen 
            name="ChatDetail" 
            component={ChatDetailScreen}
            options={{ 
              headerShown: true, 
              title: 'Chat',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
            }}
          />
        </Stack.Navigator>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

export default AppNavigator;