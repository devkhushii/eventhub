import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import VendorDashboardScreen from '../screens/vendor/VendorDashboardScreen';
import MyListingsScreen from '../screens/vendor/MyListingsScreen';
import VendorBookingsScreen from '../screens/vendor/VendorBookingsScreen';
import VendorProfileScreen from '../screens/vendor/VendorProfileScreen';
import CreateListingScreen from '../screens/vendor/CreateListingScreen';
import EditListingScreen from '../screens/vendor/EditListingScreen';
import UploadImagesScreen from '../screens/vendor/UploadImagesScreen';
import { useNotifications } from '../contexts/NotificationContext';
import colors from '../styles/colors';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabIcon = ({ name }) => (
  <Text style={{ fontSize: 20 }}>{name}</Text>
);

const NotificationBadge = ({ count }) => {
  if (!count || count <= 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

const VendorTabs = () => {
  const { pendingCount, isRealtimeAvailable, refreshNotifications } = useNotifications();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={VendorDashboardScreen}
        options={{
          tabBarIcon: () => <TabIcon name="📊" />,
        }}
      />
      <Tab.Screen
        name="MyListings"
        component={MyListingsScreen}
        options={{
          tabBarIcon: () => <TabIcon name="🏠" />,
          headerShown: true,
          headerTitle: 'My Listings',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
      <Tab.Screen
        name="Bookings"
        component={VendorBookingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View>
              <TabIcon name="📅" />
              {focused && <NotificationBadge count={pendingCount} />}
            </View>
          ),
          headerShown: true,
          headerTitle: 'Bookings',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerRight: () => (
            <View style={styles.headerRight}>
              {pendingCount > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{pendingCount} pending</Text>
                </View>
              )}
              {!isRealtimeAvailable && pendingCount > 0 && (
                <Text style={styles.pollingIndicator}>🔄</Text>
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={VendorProfileScreen}
        options={{
          tabBarIcon: () => <TabIcon name="👤" />,
          headerShown: true,
          headerTitle: 'Vendor Profile',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
    </Tab.Navigator>
  );
};

const VendorNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="VendorMain"
        component={VendorTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreateListing"
        component={CreateListingScreen}
        options={{ title: 'Create Listing' }}
      />
      <Stack.Screen
        name="EditListing"
        component={EditListingScreen}
        options={{ title: 'Edit Listing' }}
      />
      <Stack.Screen
        name="UploadImages"
        component={UploadImagesScreen}
        options={{ title: 'Upload Images' }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  headerRight: {
    marginRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBadge: {
    backgroundColor: colors.warning + '30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerBadgeText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  pollingIndicator: {
    marginLeft: 8,
    fontSize: 12,
  },
});

export default VendorNavigator;
