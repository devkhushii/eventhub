import React, { useState, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as notificationsApi from '../api/notifications';

import HomeScreen from '../screens/home/HomeScreen';
import ChatListScreen from '../screens/chat/ChatListScreen';

import ProfileScreen from '../screens/profile/ProfileScreen';
import VendorDashboardScreen from '../screens/vendor/VendorDashboardScreen';
import VendorBookingsScreen from '../screens/vendor/VendorBookingsScreen';
import VendorProfileScreen from '../screens/vendor/VendorProfileScreen';
import MyListingsScreen from '../screens/vendor/MyListingsScreen';
import CreateListingScreen from '../screens/vendor/CreateListingScreen';
import EditListingScreen from '../screens/vendor/EditListingScreen';
import UploadImagesScreen from '../screens/vendor/UploadImagesScreen';
import MyBookingsScreen from '../screens/bookings/MyBookingsScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import VendorListScreen from '../screens/admin/VendorListScreen';
import UserListScreen from '../screens/admin/UserListScreen';
import AdminListingsScreen from '../screens/admin/AdminListingsScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';

import colors from '../styles/colors';

const Tab = createBottomTabNavigator();
const ProfileStack = createNativeStackNavigator();

const TabIcon = ({ name, focused }) => (
  <Text style={[styles.icon, focused && styles.iconFocused]}>{name}</Text>
);

const ProfileStackNavigator = () => {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <ProfileStack.Screen 
        name="ProfileMain" 
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen 
        name="VendorDashboard" 
        component={VendorDashboardScreen}
        options={{ title: 'Vendor Dashboard' }}
      />
      <ProfileStack.Screen 
        name="MyListings" 
        component={MyListingsScreen}
        options={{ title: 'My Listings' }}
      />
      <ProfileStack.Screen 
        name="CreateListing" 
        component={CreateListingScreen}
        options={{ title: 'Create Listing' }}
      />
      <ProfileStack.Screen 
        name="EditListing" 
        component={EditListingScreen}
        options={{ title: 'Edit Listing' }}
      />
      <ProfileStack.Screen 
        name="UploadImages" 
        component={UploadImagesScreen}
        options={{ title: 'Upload Images' }}
      />
      <ProfileStack.Screen 
        name="VendorBookings" 
        component={VendorBookingsScreen}
        options={{ title: 'Bookings' }}
      />
      <ProfileStack.Screen 
        name="VendorProfile" 
        component={VendorProfileScreen}
        options={{ title: 'Vendor Profile' }}
      />
      <ProfileStack.Screen 
        name="UserBookings" 
        component={MyBookingsScreen}
        options={{ title: 'My Bookings' }}
      />
      <ProfileStack.Screen 
        name="AdminDashboard" 
        component={AdminDashboardScreen}
        options={{ title: 'Admin Dashboard' }}
      />
      <ProfileStack.Screen 
        name="AdminVendors" 
        component={VendorListScreen}
        options={{ title: 'Manage Vendors' }}
      />
      <ProfileStack.Screen 
        name="AdminUsers" 
        component={UserListScreen}
        options={{ title: 'Manage Users' }}
      />
      <ProfileStack.Screen 
        name="AdminListings" 
        component={AdminListingsScreen}
        options={{ title: 'Manage Listings' }}
      />
    </ProfileStack.Navigator>
  );
};

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="🏠" focused={focused} />,
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="Messages"
        component={ChatListScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="💬" focused={focused} />,
          tabBarLabel: 'Messages',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="👤" focused={focused} />,
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 65,
    paddingBottom: 8,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  icon: {
    fontSize: 22,
  },
  iconFocused: {
    transform: [{ scale: 1.1 }],
  },
});

export default MainTabNavigator;