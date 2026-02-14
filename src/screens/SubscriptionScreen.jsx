/**
 * Subscription Screen
 * 
 * Premium subscription management for providers:
 * - View current subscription status
 * - Subscribe to premium plans
 * - View transaction history
 * 
 * Features:
 * - Industry-grade UI with premium feel
 * - Real-time status updates
 * - Transaction history with details
 * - Error handling and loading states
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import { Icon } from '../components';
import {
  getSubscriptionStatus,
  getPlans,
  subscribeToplan,
  getTransactions,
  resetPremium,
} from '../services/subscriptionService';

const { width } = Dimensions.get('window');

// ============================================
// PREMIUM BADGE COMPONENT
// ============================================

const PremiumBadge = ({ isPremium, daysRemaining }) => {
  if (!isPremium) return null;
  
  return (
    <View style={[styles.premiumBadge, { backgroundColor: '#FFD700' }]}>
      <MaterialIcon name="workspace-premium" size={16} color="#000" />
      <Text style={styles.premiumBadgeText}>PREMIUM</Text>
      {daysRemaining > 0 && (
        <Text style={styles.premiumDaysText}>{daysRemaining}d left</Text>
      )}
    </View>
  );
};

// ============================================
// SUBSCRIPTION STATUS CARD
// ============================================

const StatusCard = ({ subscription, onSubscribe, loading }) => {
  const isPremium = subscription?.isPremium;
  const daysRemaining = subscription?.daysRemaining || 0;
  const endDate = subscription?.currentPlan?.endDate;
  
  if (isPremium) {
    return (
      <View style={[styles.statusCard, { backgroundColor: '#1a1a2e' }]}>
        <View style={styles.statusHeader}>
          <View style={[styles.statusIconBg, { backgroundColor: '#FFD700' }]}>
            <MaterialIcon name="workspace-premium" size={32} color="#000" />
          </View>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>Premium Active</Text>
            <Text style={styles.statusSubtitle}>
              {daysRemaining} days remaining
            </Text>
          </View>
        </View>
        
        <View style={styles.statusDivider} />
        
        <View style={styles.statusDetails}>
          <View style={styles.statusRow}>
            <MaterialIcon name="event" size={18} color="#A0AEC0" />
            <Text style={styles.statusLabel}>Valid Until</Text>
            <Text style={styles.statusValue}>
              {endDate ? new Date(endDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              }) : '-'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <MaterialIcon name="verified" size={18} color="#48BB78" />
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={[styles.statusValue, { color: '#48BB78' }]}>Active</Text>
          </View>
        </View>
        
        {daysRemaining <= 5 && (
          <TouchableOpacity
            style={styles.renewButton}
            onPress={onSubscribe}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <MaterialIcon name="autorenew" size={18} color="#000" />
                <Text style={styles.renewButtonText}>Renew Now</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }
  
  // Not premium - show upgrade prompt
  return (
    <View style={styles.upgradeCard}>
      <View style={[styles.upgradeGradient, { backgroundColor: '#667eea' }]}>
        <MaterialIcon name="star" size={48} color="#FFD700" />
        <Text style={styles.upgradeTitle}>Unlock Premium</Text>
        <Text style={styles.upgradeSubtitle}>
          Get priority listing and reach more customers
        </Text>
        
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={onSubscribe}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#667eea" />
          ) : (
            <Text style={styles.upgradeButtonText}>Subscribe Now</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ============================================
// PLAN CARD COMPONENT
// ============================================

const PlanCard = ({ plan, selected, onSelect, isCurrentPlan }) => {
  return (
    <TouchableOpacity
      style={[
        styles.planCard,
        selected && styles.planCardSelected,
        isCurrentPlan && styles.planCardCurrent
      ]}
      onPress={() => onSelect(plan)}
      disabled={isCurrentPlan}
    >
      {plan.id === 'premium_28' && (
        <View style={styles.popularTag}>
          <Text style={styles.popularTagText}>POPULAR</Text>
        </View>
      )}
      
      <View style={styles.planHeader}>
        <Text style={styles.planName}>{plan.name}</Text>
        <View style={styles.planPriceContainer}>
          <Text style={styles.planPrice}>{plan.priceDisplay}</Text>
          <Text style={styles.planDuration}>/{plan.durationDays} days</Text>
        </View>
      </View>
      
      <Text style={styles.planDescription}>{plan.description}</Text>
      
      <View style={styles.planFeatures}>
        {plan.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <MaterialIcon name="check-circle" size={16} color="#48BB78" />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
      
      {isCurrentPlan && (
        <View style={styles.currentPlanBadge}>
          <Text style={styles.currentPlanText}>Current Plan</Text>
        </View>
      )}
      
      {selected && !isCurrentPlan && (
        <View style={styles.selectedIndicator}>
          <MaterialIcon name="check" size={20} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
};

// ============================================
// TRANSACTION ITEM COMPONENT
// ============================================

const TransactionItem = ({ transaction, onPress }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'captured': return '#48BB78';
      case 'failed': return '#F56565';
      case 'refunded': return '#ED8936';
      case 'pending':
      case 'created': return '#ECC94B';
      default: return '#A0AEC0';
    }
  };
  
  const getStatusIcon = (status) => {
    switch (status) {
      case 'captured': return 'check-circle';
      case 'failed': return 'cancel';
      case 'refunded': return 'undo';
      default: return 'schedule';
    }
  };
  
  return (
    <TouchableOpacity style={styles.transactionItem} onPress={() => onPress(transaction)}>
      <View style={[styles.transactionIcon, { backgroundColor: getStatusColor(transaction.status) + '20' }]}>
        <MaterialIcon 
          name={getStatusIcon(transaction.status)} 
          size={24} 
          color={getStatusColor(transaction.status)} 
        />
      </View>
      
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionPlan}>{transaction.planName}</Text>
        <Text style={styles.transactionDate}>
          {new Date(transaction.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>
      
      <View style={styles.transactionRight}>
        <Text style={styles.transactionAmount}>{transaction.amountDisplay}</Text>
        <Text style={[styles.transactionStatus, { color: getStatusColor(transaction.status) }]}>
          {transaction.statusDisplay}
        </Text>
      </View>
      
      <MaterialIcon name="chevron-right" size={20} color="#A0AEC0" />
    </TouchableOpacity>
  );
};

// ============================================
// TRANSACTION DETAIL MODAL
// ============================================

const TransactionDetailModal = ({ visible, transaction, onClose }) => {
  if (!transaction) return null;
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Transaction Details</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcon name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Receipt Number</Text>
              <Text style={styles.detailValue}>{transaction.receiptNumber}</Text>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Order ID</Text>
              <Text style={styles.detailValue}>{transaction.orderId}</Text>
            </View>
            
            {transaction.paymentId && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Payment ID</Text>
                <Text style={styles.detailValue}>{transaction.paymentId}</Text>
              </View>
            )}
            
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Plan</Text>
              <Text style={styles.detailValue}>{transaction.planName}</Text>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={[styles.detailValue, styles.detailAmount]}>
                {transaction.amountDisplay}
              </Text>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Payment Method</Text>
              <Text style={styles.detailValue}>{transaction.paymentMethodDisplay || 'N/A'}</Text>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: transaction.status === 'captured' ? '#C6F6D520' : '#FED7D720' }]}>
                <Text style={[styles.statusBadgeText, { color: transaction.status === 'captured' ? '#48BB78' : '#F56565' }]}>
                  {transaction.statusDisplay}
                </Text>
              </View>
            </View>
            
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>
                {new Date(transaction.createdAt).toLocaleString('en-IN')}
              </Text>
            </View>
            
            {transaction.subscriptionPeriod && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Subscription Period</Text>
                <Text style={styles.detailValue}>
                  {new Date(transaction.subscriptionPeriod.startDate).toLocaleDateString('en-IN')} - {new Date(transaction.subscriptionPeriod.endDate).toLocaleDateString('en-IN')}
                </Text>
              </View>
            )}
            
            {transaction.error && (
              <View style={[styles.detailSection, styles.errorSection]}>
                <Text style={styles.detailLabel}>Error</Text>
                <Text style={styles.errorText}>{transaction.error}</Text>
              </View>
            )}
          </ScrollView>
          
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ============================================
// MAIN SCREEN COMPONENT
// ============================================

const SubscriptionScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { userType } = useApp();
  
  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  
  // Load data
  const loadData = useCallback(async () => {
    try {
      // Load subscription status, plans, and transactions in parallel
      const [statusResult, plansResult, transactionsResult] = await Promise.all([
        getSubscriptionStatus(),
        getPlans(),
        getTransactions(1, 10),
      ]);
      
      if (statusResult.success) {
        setSubscription(statusResult.subscription);
      }
      
      if (plansResult.success) {
        setPlans(plansResult.plans);
        // Auto-select first plan if not premium
        if (!statusResult.subscription?.isPremium && plansResult.plans.length > 0) {
          setSelectedPlan(plansResult.plans[0]);
        }
      }
      
      if (transactionsResult.success) {
        setTransactions(transactionsResult.transactions);
      }
    } catch (error) {
      console.error('[SubscriptionScreen] Load data error:', error);
      Alert.alert('Error', 'Failed to load subscription data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);
  
  // Handle subscribe
  const handleSubscribe = useCallback(async () => {
    if (!selectedPlan) {
      Alert.alert('Select Plan', 'Please select a subscription plan');
      return;
    }
    
    setSubscribing(true);
    setSubscriptionStatus('');
    
    try {
      const result = await subscribeToplan(selectedPlan.id, (status) => {
        setSubscriptionStatus(status);
      });
      
      if (result.success) {
        Alert.alert(
          '🎉 Welcome to Premium!',
          result.message || 'Your premium subscription is now active.',
          [{ text: 'Great!', onPress: () => loadData() }]
        );
      } else if (result.cancelled) {
        // User cancelled - no alert needed
        setSubscriptionStatus('');
      } else {
        Alert.alert(
          'Payment Failed',
          result.error || 'Unable to process payment. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSubscribing(false);
      setSubscriptionStatus('');
    }
  }, [selectedPlan, loadData]);
  
  // Handle transaction press
  const handleTransactionPress = useCallback((transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionModal(true);
  }, []);
  
  // Handle reset premium (DEVELOPMENT ONLY)
  const handleResetPremium = useCallback(async () => {
    Alert.alert(
      '⚠️ Reset Premium',
      'This will remove your premium status. This is for testing only. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const result = await resetPremium();
              if (result.success) {
                Alert.alert('Success', result.message || 'Premium status reset successfully');
                loadData();
              } else {
                Alert.alert('Error', result.error || 'Failed to reset premium');
              }
            } catch (error) {
              Alert.alert('Error', 'Something went wrong');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }, [loadData]);
  
  // Check if user is provider
  if (userType !== 'provider') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow_back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Premium</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={styles.errorContainer}>
          <MaterialIcon name="error-outline" size={64} color="#A0AEC0" />
          <Text style={styles.errorText}>
            Premium subscription is only available for service providers.
          </Text>
        </View>
      </View>
    );
  }
  
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow_back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Premium</Text>
        <PremiumBadge isPremium={subscription?.isPremium} daysRemaining={subscription?.daysRemaining} />
      </View>
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card */}
        <StatusCard
          subscription={subscription}
          onSubscribe={handleSubscribe}
          loading={subscribing}
        />
        
        {/* Processing Status */}
        {subscriptionStatus ? (
          <View style={styles.processingCard}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.processingText}>{subscriptionStatus}</Text>
          </View>
        ) : null}
        
        {/* Plans Section (show only if not premium or expiring soon) */}
        {(!subscription?.isPremium || subscription?.daysRemaining <= 5) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose Your Plan</Text>
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlan?.id === plan.id}
                onSelect={setSelectedPlan}
                isCurrentPlan={subscription?.currentPlan?.planId === plan.id && subscription?.isPremium}
              />
            ))}
            
            {/* Subscribe Button */}
            {selectedPlan && (
              <TouchableOpacity
                style={[styles.subscribeButton, subscribing && styles.subscribeButtonDisabled]}
                onPress={handleSubscribe}
                disabled={subscribing}
              >
                {subscribing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialIcon name="lock" size={20} color="#fff" />
                    <Text style={styles.subscribeButtonText}>
                      Subscribe for {selectedPlan.priceDisplay}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Stats Section (for premium users) */}
        {subscription?.stats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{subscription.stats.totalSubscriptions}</Text>
                <Text style={styles.statLabel}>Subscriptions</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{subscription.stats.totalSpentDisplay}</Text>
                <Text style={styles.statLabel}>Total Spent</Text>
              </View>
            </View>
          </View>
        )}
        
        {/* Transaction History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
          </View>
          
          {transactions.length === 0 ? (
            <View style={styles.emptyTransactions}>
              <MaterialIcon name="receipt-long" size={48} color="#E2E8F0" />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            transactions.map((transaction) => (
              <TransactionItem
                key={transaction.id}
                transaction={transaction}
                onPress={handleTransactionPress}
              />
            ))
          )}
        </View>
        
        {/* Benefits Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premium Benefits</Text>
          <View style={styles.benefitsList}>
            {[
              { icon: 'trending-up', title: 'Priority Listing', desc: 'Appear at the top of search results' },
              { icon: 'workspace-premium', title: 'Premium Badge', desc: 'Stand out with a verified premium badge' },
              { icon: 'location-on', title: 'Extended Reach', desc: 'Get discovered by more customers' },
              { icon: 'analytics', title: 'Analytics', desc: 'Track your profile views and engagement' },
              { icon: 'support-agent', title: 'Priority Support', desc: '24/7 dedicated customer support' },
            ].map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <MaterialIcon name={benefit.icon} size={24} color="#2563EB" />
                </View>
                <View style={styles.benefitInfo}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDesc}>{benefit.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
        
        {/* DEV ONLY: Reset Premium Button */}
        {__DEV__ && subscription?.isPremium && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>🔧 Developer Options</Text>
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={handleResetPremium}
            >
              <MaterialIcon name="refresh" size={20} color="#EF4444" />
              <Text style={styles.resetButtonText}>Reset Premium (Test Again)</Text>
            </TouchableOpacity>
            <Text style={styles.devWarning}>
              This option is only visible in development mode
            </Text>
          </View>
        )}
        
        {/* Footer spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
      
      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        visible={showTransactionModal}
        transaction={selectedTransaction}
        onClose={() => {
          setShowTransactionModal(false);
          setSelectedTransaction(null);
        }}
      />
    </View>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  
  // Premium Badge
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
  premiumDaysText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#000',
    opacity: 0.7,
  },
  
  // Content
  content: {
    flex: 1,
    padding: 16,
  },
  
  // Status Card
  statusCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statusIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#A0AEC0',
    marginTop: 2,
  },
  statusDivider: {
    height: 1,
    backgroundColor: '#2D3748',
    marginVertical: 16,
  },
  statusDetails: {
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    flex: 1,
    fontSize: 14,
    color: '#A0AEC0',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  renewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  renewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  
  // Upgrade Card
  upgradeCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  upgradeGradient: {
    padding: 24,
    alignItems: 'center',
  },
  upgradeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
  },
  upgradeSubtitle: {
    fontSize: 14,
    color: '#E2E8F0',
    textAlign: 'center',
    marginTop: 8,
  },
  upgradeButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 20,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
  
  // Processing
  processingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF5FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  processingText: {
    fontSize: 14,
    color: '#2563EB',
  },
  
  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },
  
  // Plan Card
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  planCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EBF5FF',
  },
  planCardCurrent: {
    opacity: 0.7,
  },
  popularTag: {
    position: 'absolute',
    top: -1,
    right: 16,
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  popularTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  planPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2563EB',
  },
  planDuration: {
    fontSize: 12,
    color: '#6B7280',
  },
  planDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  planFeatures: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: '#4B5563',
  },
  currentPlanBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  currentPlanText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Subscribe Button
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  subscribeButtonDisabled: {
    opacity: 0.7,
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Stats
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  
  // Transactions
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionPlan: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  transactionDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  transactionStatus: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  emptyTransactions: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#A0AEC0',
    marginTop: 12,
  },
  
  // Benefits
  benefitsList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  benefitInfo: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  benefitDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  detailAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2563EB',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorSection: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
  },
  modalCloseButton: {
    backgroundColor: '#F3F4F6',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  
  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  
  // Reset Premium Button (Dev Only)
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 8,
    gap: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  devWarning: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default SubscriptionScreen;
