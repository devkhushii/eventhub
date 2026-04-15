import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import UserListScreen from '../screens/admin/UserListScreen';
import VendorListScreen from '../screens/admin/VendorListScreen';
import AdminListingsScreen from '../screens/admin/AdminListingsScreen';
import colors from '../styles/colors';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabIcon = ({ name, focused }) => (
  <Text style={{ fontSize: 20 }}>{name}</Text>
);

const AdminTabs = () => {
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
        component={AdminDashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="📊" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Vendors"
        component={VendorListScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="🏪" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Listings"
        component={AdminListingsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="📋" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Users"
        component={UserListScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="👥" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
};

const AdminNavigator = () => {
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
        name="AdminMain"
        component={AdminTabs}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default AdminNavigator;
