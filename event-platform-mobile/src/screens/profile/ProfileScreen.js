import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/Card';
import colors from '../../styles/colors';
import { getInitials } from '../../utils/helpers';
import * as vendorsApi from '../../api/vendors';
import { FontAwesome5 } from '@expo/vector-icons';

const MenuItem = ({ title, subtitle, icon, onPress, showArrow = true }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={styles.menuIconContainer}>
      <FontAwesome5 name={icon} size={18} color={colors.primary} />
    </View>
    <View style={styles.menuContent}>
      <Text style={styles.menuTitle}>{title}</Text>
      {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
    </View>
    {showArrow && <FontAwesome5 name="chevron-right" size={16} color={colors.textMuted} />}
  </TouchableOpacity>
);

const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [vendorStatus, setVendorStatus] = useState(null);

  useEffect(() => {
    checkVendorStatus();
  }, [user]);

  const checkVendorStatus = async () => {
    if (!user || user.role !== 'VENDOR') {
      setVendorStatus(null);
      return;
    }
    try {
      const vendorData = await vendorsApi.getVendorProfile();
      setVendorStatus(vendorData?.verification_status || null);
    } catch (error) {
      setVendorStatus(null);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  const userRole = (user?.role || 'customer').toLowerCase();
  const isVendor = userRole === 'vendor' && vendorStatus === 'approved';
  const isVendorPending = userRole === 'vendor' && vendorStatus === 'pending';
  const isVendorRejected = userRole === 'vendor' && vendorStatus === 'rejected';
  const isAdmin = userRole === 'admin';

  const renderVendorMenu = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Vendor Dashboard</Text>
      </View>
      <Card style={styles.menuCard}>
        <MenuItem
          title="Dashboard"
          subtitle="Overview and stats"
          icon="chart-bar"
          onPress={() => navigation.navigate('VendorDashboard')}
        />
        <View style={styles.divider} />
        <MenuItem
          title="My Listings"
          subtitle="Manage your listings"
          icon="home"
          onPress={() => navigation.navigate('MyListings')}
        />
        <View style={styles.divider} />
        <MenuItem
          title="Create Listing"
          subtitle="Add new listing"
          icon="plus"
          onPress={() => navigation.navigate('CreateListing')}
        />
        <View style={styles.divider} />
        <MenuItem
          title="Bookings"
          subtitle="Manage bookings"
          icon="calendar-alt"
          onPress={() => navigation.navigate('VendorBookings')}
        />
        <View style={styles.divider} />
        <MenuItem
          title="Vendor Profile"
          subtitle="Business details"
          icon="store"
          onPress={() => navigation.navigate('VendorProfile')}
        />
      </Card>
    </>
  );

  const renderAdminMenu = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Admin Dashboard</Text>
      </View>
      <Card style={styles.menuCard}>
        <MenuItem
          title="Dashboard"
          subtitle="Platform overview"
          icon="chart-pie"
          onPress={() => navigation.navigate('AdminDashboard')}
        />
        <View style={styles.divider} />
        <MenuItem
          title="Manage Vendors"
          subtitle="Vendor approvals"
          icon="store"
          onPress={() => navigation.navigate('AdminVendors')}
        />
        <View style={styles.divider} />
        <MenuItem
          title="Manage Users"
          subtitle="User management"
          icon="users"
          onPress={() => navigation.navigate('AdminUsers')}
        />
        <View style={styles.divider} />
        <MenuItem
          title="Manage Listings"
          subtitle="Content moderation"
          icon="clipboard-list"
          onPress={() => navigation.navigate('AdminListings')}
        />
      </Card>
    </>
  );

  const renderUserMenu = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Activity</Text>
      </View>
      <Card style={styles.menuCard}>
        <MenuItem
          title="My Bookings"
          subtitle="View your bookings"
          icon="calendar-alt"
          onPress={() => navigation.navigate('UserBookings')}
        />
      </Card>
    </>
  );

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getInitials(user?.full_name || 'User')}
            </Text>
          </View>
          {isVendor && (
            <View style={styles.vendorBadge}>
              <Text style={styles.vendorBadgeText}>Vendor</Text>
            </View>
          )}
          {isVendorPending && (
            <View style={[styles.vendorBadge, styles.pendingBadge]}>
              <Text style={styles.vendorBadgeText}>Pending</Text>
            </View>
          )}
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
        </View>
        <Text style={styles.name}>{user?.full_name || 'User'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {(isVendor || isAdmin) && (
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => navigation.navigate(isVendor ? 'VendorDashboard' : 'AdminDashboard')}
            >
              <FontAwesome5 name="rocket" size={24} color={colors.textLight} style={{ marginRight: 12 }} />
              <Text style={styles.quickActionText}>
                {isVendor ? 'Vendor Panel' : 'Admin Panel'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isVendor && renderVendorMenu()}
        {isAdmin && renderAdminMenu()}
        {!isVendor && !isAdmin && renderUserMenu()}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Account</Text>
        </View>
        <Card style={styles.menuCard}>
          <MenuItem
            title="Payment History"
            subtitle="View transactions"
            icon="credit-card"
            onPress={() => navigation.navigate('PaymentHistory')}
          />
        </Card>

        {isVendorPending && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Vendor Status</Text>
            </View>
            <Card style={styles.menuCard}>
              <View style={styles.pendingStatusCard}>
                <FontAwesome5 name="hourglass-half" size={40} color={colors.warning} style={{ marginBottom: 12 }} />
                <Text style={styles.pendingStatusTitle}>Application Pending</Text>
                <Text style={styles.pendingStatusText}>
                  Your vendor application is under review. You'll be notified once approved.
                </Text>
              </View>
            </Card>
          </>
        )}

        {isVendorRejected && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Vendor Application</Text>
            </View>
            <Card style={styles.menuCard}>
              <MenuItem
                title="Retry Application"
                subtitle="Your previous application was rejected"
                icon="sync-alt"
                onPress={() => navigation.navigate('BecomeVendor')}
              />
            </Card>
          </>
        )}

        {!isVendor && !isVendorPending && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Become a Partner</Text>
            </View>
            <Card style={styles.menuCard}>
              <MenuItem
                title="Become a Vendor"
                subtitle="Start listing your services"
                icon="store"
                onPress={() => navigation.navigate('BecomeVendor')}
              />
            </Card>
          </>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Support</Text>
        </View>
        <Card style={styles.menuCard}>
          <MenuItem
            title="Help Center"
            subtitle="Get help and support"
            icon="question-circle"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <MenuItem
            title="Terms & Privacy"
            subtitle="Legal information"
            icon="file-contract"
            onPress={() => {}}
          />
        </Card>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: 'bold',
  },
  vendorBadge: {
    position: 'absolute',
    bottom: 0,
    right: -8,
    backgroundColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingBadge: {
    backgroundColor: '#666666',
  },
  vendorBadgeText: {
    color: colors.textLight,
    fontSize: 10,
    fontWeight: '600',
  },
  adminBadge: {
    position: 'absolute',
    bottom: 0,
    right: -8,
    backgroundColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  editButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#EEEEEE',
  },
  editButtonText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  quickActions: {
    marginBottom: 8,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    padding: 16,
    borderRadius: 16,
  },
  quickActionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textLight,
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuCard: {
    padding: 0,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuIcon: {
    fontSize: 18,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 20,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginLeft: 68,
  },
  logoutButton: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#EEEEEE',
    alignItems: 'center',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.success,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 20,
    marginBottom: 40,
  },
  pendingStatusCard: {
    padding: 20,
    alignItems: 'center',
  },
  pendingStatusIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  pendingStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  pendingStatusText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ProfileScreen;