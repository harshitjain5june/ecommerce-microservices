const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const CircuitBreaker = require('opossum');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// Service URLs
const PRODUCTS_SERVICE_URL = process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3002';
const CART_SERVICE_URL = process.env.CART_SERVICE_URL || 'http://localhost:3003';
const NOTIFICATIONS_SERVICE_URL = process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:3005';

// JWT Secret for signing tokens when calling other services
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// In-memory orders storage (in production, use database)
let orders = [];
let orderIdCounter = 1000; // Start from 1000 for better order IDs

// Order status enum
const ORDER_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered'
};

// Payment status enum
const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded'
};

// Circuit breaker configuration
const circuitBreakerOptions = {
  timeout: 5000, // 5 seconds timeout
  errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
  resetTimeout: 30000, // Try again after 30 seconds
  rollingCountTimeout: 10000, // 10 second rolling window
  rollingCountBuckets: 5, // 5 buckets in the rolling window
  volumeThreshold: 5, // Minimum 5 requests before circuit can open
};

// Function to call external services
const callExternalService = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const error = new Error(`Service responded with status: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return response.json();
};

// Create circuit breakers for external services
const productsServiceBreaker = new CircuitBreaker(callExternalService, {
  ...circuitBreakerOptions,
  name: 'products-service'
});

const cartServiceBreaker = new CircuitBreaker(callExternalService, {
  ...circuitBreakerOptions,
  name: 'cart-service'
});

const notificationsServiceBreaker = new CircuitBreaker(callExternalService, {
  ...circuitBreakerOptions,
  name: 'notifications-service'
});

// Circuit breaker event handlers
[productsServiceBreaker, cartServiceBreaker, notificationsServiceBreaker].forEach(breaker => {
  breaker.on('open', () => {
    console.log(`🔴 Circuit breaker opened for ${breaker.name}`);
  });

  breaker.on('halfOpen', () => {
    console.log(`🟡 Circuit breaker half-open for ${breaker.name}`);
  });

  breaker.on('close', () => {
    console.log(`🟢 Circuit breaker closed for ${breaker.name}`);
  });

  breaker.fallback((url, options) => {
    console.log(`⚡ Circuit breaker fallback triggered for ${breaker.name}`);
    return {
      success: false,
      message: `${breaker.name} is temporarily unavailable. Please try again later.`,
      fallback: true
    };
  });
});

// Helper function to generate order ID
const generateOrderId = () => {
  return ++orderIdCounter;
};

// Helper function to validate cart with Cart service
const validateCartWithService = async (userId, authToken) => {
  try {
    const url = `${CART_SERVICE_URL}/api/cart/validate/${userId}`;
    const result = await cartServiceBreaker.fire(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    return result;
  } catch (error) {
    console.error('Error validating cart:', error);
    throw error;
  }
};

// Helper function to update product stock
const updateProductStock = async (productId, quantity, authToken) => {
  try {
    const url = `${PRODUCTS_SERVICE_URL}/api/products/${productId}/stock`;
    const result = await productsServiceBreaker.fire(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-user-role': 'admin', // Order service acts as admin for stock updates
        'x-user-id': 'order-service',
        'x-username': 'order-service'
      },
      body: JSON.stringify({
        quantity: quantity,
        operation: 'decrease'
      })
    });

    return result;
  } catch (error) {
    console.error('Error updating product stock:', error);
    throw error;
  }
};

// Helper function to restore product stock (rollback)
const restoreProductStock = async (productId, quantity, authToken) => {
  try {
    const url = `${PRODUCTS_SERVICE_URL}/api/products/${productId}/stock`;
    const result = await productsServiceBreaker.fire(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-user-role': 'admin',
        'x-user-id': 'order-service',
        'x-username': 'order-service'
      },
      body: JSON.stringify({
        quantity: quantity,
        operation: 'increase'
      })
    });

    return result;
  } catch (error) {
    console.error('Error restoring product stock:', error);
    throw error;
  }
};

// Helper function to clear cart
const clearUserCart = async (userId, authToken) => {
  try {
    const url = `${CART_SERVICE_URL}/api/cart/clear/${userId}`;
    const result = await cartServiceBreaker.fire(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    return result;
  } catch (error) {
    console.error('Error clearing cart:', error);
    // Don't throw error for cart clearing - it's not critical
    return { success: false, message: 'Failed to clear cart' };
  }
};

// Helper function to send notification
const sendNotification = async (userId, message, type, authToken) => {
  try {
    const url = `${NOTIFICATIONS_SERVICE_URL}/api/notifications/send`;
    const result = await notificationsServiceBreaker.fire(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        userId: userId,
        message: message,
        type: type
      })
    });

    return result;
  } catch (error) {
    console.error('Error sending notification:', error);
    // Don't throw error for notifications - they're not critical for order processing
    return { success: false, message: 'Failed to send notification' };
  }
};

// Mock payment processing function
const processPayment = async (paymentDetails, totalAmount) => {
  // Simulate payment processing delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  // Mock payment logic - 90% success rate
  const isSuccessful = Math.random() > 0.1;
  
  if (isSuccessful) {
    return {
      success: true,
      transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: totalAmount,
      status: PAYMENT_STATUS.COMPLETED,
      processedAt: new Date()
    };
  } else {
    return {
      success: false,
      status: PAYMENT_STATUS.FAILED,
      error: 'Payment failed due to insufficient funds or invalid payment method',
      processedAt: new Date()
    };
  }
};

// Get user's orders
app.get('/api/orders/:userId', (req, res) => {
  try {
    const userId = req.params.userId;
    const { status, page = 1, limit = 10 } = req.query;

    let userOrders = orders.filter(order => order.userId === userId);

    // Filter by status if provided
    if (status) {
      userOrders = userOrders.filter(order => order.status === status);
    }

    // Sort by creation date (newest first)
    userOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedOrders = userOrders.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        orders: paginatedOrders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(userOrders.length / limit),
          totalOrders: userOrders.length,
          hasNextPage: endIndex < userOrders.length,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
});

// Get specific order by ID
app.get('/api/orders/order/:orderId', (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const order = orders.find(o => o.id === orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order',
      error: error.message
    });
  }
});

// Place new order
app.post('/api/orders/place', async (req, res) => {
  const authToken = req.headers.authorization?.split(' ')[1];
  
  if (!authToken) {
    return res.status(401).json({
      success: false,
      message: 'Authorization token required'
    });
  }

  try {
    const { userId, shippingAddress, paymentMethod } = req.body;

    // Validation
    if (!userId || !shippingAddress || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'User ID, shipping address, and payment method are required'
      });
    }

    console.log(`📦 Processing order for user ${userId}`);

    // Step 1: Validate cart with Cart service
    const cartValidation = await validateCartWithService(userId, authToken);
    
    if (!cartValidation.success) {
      return res.status(400).json({
        success: false,
        message: cartValidation.message || 'Cart validation failed'
      });
    }

    const { cart, validation } = cartValidation.data;
    
    if (!validation.allAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Some items in cart are not available',
        unavailableItems: validation.items.filter(item => !item.available)
      });
    }

    if (cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Step 2: Create order with pending status
    const orderId = generateOrderId();
    const newOrder = {
      id: orderId,
      userId: userId,
      items: cart.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
        category: item.category,
        subtotal: item.price * item.quantity
      })),
      totalAmount: cart.totalAmount,
      totalItems: cart.totalItems,
      status: ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING,
      shippingAddress: shippingAddress,
      paymentMethod: paymentMethod,
      createdAt: new Date(),
      updatedAt: new Date(),
      timeline: [
        {
          status: ORDER_STATUS.PENDING,
          message: 'Order created and pending validation',
          timestamp: new Date()
        }
      ]
    };

    orders.push(newOrder);
    console.log(`✅ Order ${orderId} created with pending status`);

    // Step 3: Reserve inventory (decrease stock)
    const stockUpdates = [];
    let inventoryReservationFailed = false;
    let failedProduct = null;

    try {
      for (const item of cart.items) {
        console.log(`📦 Reserving ${item.quantity} units of product ${item.productId}`);
        const stockUpdate = await updateProductStock(item.productId, item.quantity, authToken);
        
        if (!stockUpdate.success) {
          inventoryReservationFailed = true;
          failedProduct = item;
          break;
        }
        
        stockUpdates.push({
          productId: item.productId,
          quantity: item.quantity,
          success: true
        });
      }
    } catch (error) {
      console.error('Inventory reservation failed:', error);
      inventoryReservationFailed = true;
    }

    // If inventory reservation failed, rollback and cancel order
    if (inventoryReservationFailed) {
      console.log(`❌ Inventory reservation failed for order ${orderId}, rolling back`);
      
      // Rollback successful stock updates
      for (const update of stockUpdates) {
        if (update.success) {
          try {
            await restoreProductStock(update.productId, update.quantity, authToken);
            console.log(`🔄 Restored ${update.quantity} units of product ${update.productId}`);
          } catch (rollbackError) {
            console.error(`Failed to rollback stock for product ${update.productId}:`, rollbackError);
          }
        }
      }

      // Update order status to cancelled
      newOrder.status = ORDER_STATUS.CANCELLED;
      newOrder.paymentStatus = PAYMENT_STATUS.FAILED;
      newOrder.cancellationReason = failedProduct ? 
        `Insufficient stock for product: ${failedProduct.productName}` : 
        'Inventory reservation failed';
      newOrder.updatedAt = new Date();
      newOrder.timeline.push({
        status: ORDER_STATUS.CANCELLED,
        message: newOrder.cancellationReason,
        timestamp: new Date()
      });

      // Send failure notification
      await sendNotification(
        userId,
        `Order #${orderId} has been cancelled due to inventory issues. ${newOrder.cancellationReason}`,
        'order_cancelled',
        authToken
      );

      return res.status(400).json({
        success: false,
        message: 'Order cancelled due to inventory issues',
        order: newOrder,
        reason: newOrder.cancellationReason
      });
    }

    console.log(`✅ Inventory reserved successfully for order ${orderId}`);

    // Step 4: Process payment
    newOrder.status = ORDER_STATUS.PROCESSING;
    newOrder.paymentStatus = PAYMENT_STATUS.PROCESSING;
    newOrder.updatedAt = new Date();
    newOrder.timeline.push({
      status: ORDER_STATUS.PROCESSING,
      message: 'Inventory reserved, processing payment',
      timestamp: new Date()
    });

    console.log(`💳 Processing payment for order ${orderId}`);
    const paymentResult = await processPayment(paymentMethod, cart.totalAmount);

    if (!paymentResult.success) {
      console.log(`❌ Payment failed for order ${orderId}, cancelling order`);
      
      // Rollback inventory
      for (const update of stockUpdates) {
        try {
          await restoreProductStock(update.productId, update.quantity, authToken);
          console.log(`🔄 Restored ${update.quantity} units of product ${update.productId}`);
        } catch (rollbackError) {
          console.error(`Failed to rollback stock for product ${update.productId}:`, rollbackError);
        }
      }

      // Update order status
      newOrder.status = ORDER_STATUS.CANCELLED;
      newOrder.paymentStatus = PAYMENT_STATUS.FAILED;
      newOrder.cancellationReason = 'Payment failed';
      newOrder.paymentDetails = paymentResult;
      newOrder.updatedAt = new Date();
      newOrder.timeline.push({
        status: ORDER_STATUS.CANCELLED,
        message: `Payment failed: ${paymentResult.error}`,
        timestamp: new Date()
      });

      // Send failure notification
      await sendNotification(
        userId,
        `Order #${orderId} has been cancelled due to payment failure. Please check your payment method and try again.`,
        'order_cancelled',
        authToken
      );

      return res.status(400).json({
        success: false,
        message: 'Order cancelled due to payment failure',
        order: newOrder,
        paymentError: paymentResult.error
      });
    }

    console.log(`✅ Payment successful for order ${orderId}`);

    // Step 5: Confirm order
    newOrder.status = ORDER_STATUS.CONFIRMED;
    newOrder.paymentStatus = PAYMENT_STATUS.COMPLETED;
    newOrder.paymentDetails = paymentResult;
    newOrder.updatedAt = new Date();
    newOrder.timeline.push({
      status: ORDER_STATUS.CONFIRMED,
      message: 'Payment successful, order confirmed',
      timestamp: new Date()
    });

    // Step 6: Clear cart
    const cartClearResult = await clearUserCart(userId, authToken);
    if (cartClearResult.success) {
      console.log(`🧹 Cart cleared for user ${userId}`);
    } else {
      console.log(`⚠️ Failed to clear cart for user ${userId}, but order is confirmed`);
    }

    // Step 7: Send success notifications
    await sendNotification(
      userId,
      `Order #${orderId} has been confirmed! Your items will be shipped to ${shippingAddress.address}. Total amount: $${cart.totalAmount.toFixed(2)}`,
      'order_confirmed',
      authToken
    );

    // System notification (for admin/monitoring)
    console.log(`🎉 Order ${orderId} completed successfully for user ${userId}. Total: $${cart.totalAmount.toFixed(2)}`);

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: newOrder
    });

  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({
      success: false,
      message: 'Error placing order',
      error: error.message
    });
  }
});

// Update order status
app.put('/api/orders/:orderId/status', (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const { status, message } = req.body;

    if (!status || !Object.values(ORDER_STATUS).includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required',
        validStatuses: Object.values(ORDER_STATUS)
      });
    }

    const orderIndex = orders.findIndex(o => o.id === orderId);
    
    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const order = orders[orderIndex];
    const previousStatus = order.status;
    
    order.status = status;
    order.updatedAt = new Date();
    order.timeline.push({
      status: status,
      message: message || `Order status updated to ${status}`,
      timestamp: new Date()
    });

    console.log(`📝 Order ${orderId} status updated from ${previousStatus} to ${status}`);

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order status',
      error: error.message
    });
  }
});

// Get order statistics
app.get('/api/orders/stats', (req, res) => {
  try {
    const { userId } = req.query;
    
    let filteredOrders = orders;
    if (userId) {
      filteredOrders = orders.filter(order => order.userId === userId);
    }

    const stats = {
      totalOrders: filteredOrders.length,
      ordersByStatus: {},
      totalRevenue: 0,
      averageOrderValue: 0
    };

    // Calculate stats
    Object.values(ORDER_STATUS).forEach(status => {
      stats.ordersByStatus[status] = filteredOrders.filter(order => order.status === status).length;
    });

    const confirmedOrders = filteredOrders.filter(order => order.status === ORDER_STATUS.CONFIRMED);
    stats.totalRevenue = confirmedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    stats.averageOrderValue = confirmedOrders.length > 0 ? stats.totalRevenue / confirmedOrders.length : 0;

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching order statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order statistics',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const circuitBreakerStats = {
    productsService: {
      state: productsServiceBreaker.stats.state,
      requests: productsServiceBreaker.stats.requests,
      failures: productsServiceBreaker.stats.failures
    },
    cartService: {
      state: cartServiceBreaker.stats.state,
      requests: cartServiceBreaker.stats.requests,
      failures: cartServiceBreaker.stats.failures
    },
    notificationsService: {
      state: notificationsServiceBreaker.stats.state,
      requests: notificationsServiceBreaker.stats.requests,
      failures: notificationsServiceBreaker.stats.failures
    }
  };

  res.json({
    success: true,
    message: 'Orders service is running',
    timestamp: new Date().toISOString(),
    totalOrders: orders.length,
    circuitBreakers: circuitBreakerStats
  });
});

// Circuit breaker health endpoint
app.get('/api/health/circuit-breakers', (req, res) => {
  res.json({
    success: true,
    circuitBreakers: {
      productsService: {
        name: 'products-service',
        state: productsServiceBreaker.stats.state,
        isOpen: productsServiceBreaker.opened,
        isHalfOpen: productsServiceBreaker.halfOpen,
        stats: productsServiceBreaker.stats
      },
      cartService: {
        name: 'cart-service',
        state: cartServiceBreaker.stats.state,
        isOpen: cartServiceBreaker.opened,
        isHalfOpen: cartServiceBreaker.halfOpen,
        stats: cartServiceBreaker.stats
      },
      notificationsService: {
        name: 'notifications-service',
        state: notificationsServiceBreaker.stats.state,
        isOpen: notificationsServiceBreaker.opened,
        isHalfOpen: notificationsServiceBreaker.halfOpen,
        stats: notificationsServiceBreaker.stats
      }
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Orders Service API',
    endpoints: {
      getUserOrders: 'GET /api/orders/:userId',
      getOrder: 'GET /api/orders/order/:orderId',
      placeOrder: 'POST /api/orders/place',
      updateOrderStatus: 'PUT /api/orders/:orderId/status',
      getOrderStats: 'GET /api/orders/stats',
      health: 'GET /api/health',
      circuitBreakerHealth: 'GET /api/health/circuit-breakers'
    },
    features: [
      'Complete order lifecycle management',
      'Inventory reservation and rollback',
      'Mock payment processing',
      'Circuit breaker pattern for external services',
      'Automatic cart clearing on successful orders',
      'Comprehensive order timeline tracking',
      'Integration with Products, Cart, and Notifications services',
      'Order statistics and reporting'
    ],
    orderStatuses: Object.values(ORDER_STATUS),
    paymentStatuses: Object.values(PAYMENT_STATUS)
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Orders Service Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`📦 Orders service running on port ${PORT}`);
  console.log(`📡 Service URLs:`);
  console.log(`   Products: ${PRODUCTS_SERVICE_URL}`);
  console.log(`   Cart: ${CART_SERVICE_URL}`);
  console.log(`   Notifications: ${NOTIFICATIONS_SERVICE_URL}`);
  console.log(`🔄 Circuit breakers enabled for all external services`);
  console.log(`Available endpoints:`);
  console.log(`- GET /api/orders/:userId (get user orders)`);
  console.log(`- GET /api/orders/order/:orderId (get specific order)`);
  console.log(`- POST /api/orders/place (place new order)`);
  console.log(`- PUT /api/orders/:orderId/status (update order status)`);
  console.log(`- GET /api/orders/stats (order statistics)`);
  console.log(`- GET /api/health (health check)`);
  console.log(`- GET /api/health/circuit-breakers (circuit breaker status)`);
});

module.exports = app;