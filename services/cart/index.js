const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const CircuitBreaker = require('opossum');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Products Service URL
const PRODUCTS_SERVICE_URL = process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3002';

// Middleware
app.use(cors());
app.use(express.json());

// In-memory cart storage (in production, use Redis or database)
let carts = {};

// Circuit breaker configuration for Products service
const circuitBreakerOptions = {
  timeout: 5000, // 5 seconds timeout
  errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
  resetTimeout: 30000, // Try again after 30 seconds
  rollingCountTimeout: 10000, // 10 second rolling window
  rollingCountBuckets: 5, // 5 buckets in the rolling window
  volumeThreshold: 10, // Minimum 10 requests before circuit can open
  name: 'products-service'
};

// Function to call Products service
const callProductsService = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const error = new Error(`Products service responded with status: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return response.json();
};

// Create circuit breaker for Products service
const productsServiceBreaker = new CircuitBreaker(callProductsService, circuitBreakerOptions);

// Circuit breaker event handlers
productsServiceBreaker.on('open', () => {
  console.log('🔴 Circuit breaker opened for Products service');
});

productsServiceBreaker.on('halfOpen', () => {
  console.log('🟡 Circuit breaker half-open for Products service');
});

productsServiceBreaker.on('close', () => {
  console.log('🟢 Circuit breaker closed for Products service');
});

productsServiceBreaker.on('fallback', (result) => {
  console.log('⚡ Circuit breaker fallback triggered for Products service');
});

// Fallback function for when Products service is unavailable
productsServiceBreaker.fallback((url, options) => {
  console.log('Using fallback for Products service call');
  return {
    success: false,
    message: 'Products service is temporarily unavailable. Please try again later.',
    fallback: true
  };
});

// Helper function to get user's cart
const getUserCart = (userId) => {
  if (!carts[userId]) {
    carts[userId] = {
      userId: userId,
      items: [],
      totalItems: 0,
      totalAmount: 0.0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  return carts[userId];
};

// Helper function to calculate cart totals
const calculateCartTotals = (cart) => {
  cart.totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
  cart.totalAmount = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  cart.updatedAt = new Date();
};

// Helper function to validate product with Products service
const validateProduct = async (productId) => {
  try {
    const url = `${PRODUCTS_SERVICE_URL}/api/products/${productId}`;
    const result = await productsServiceBreaker.fire(url);
    
    if (result.fallback) {
      return { valid: false, fallback: true, message: result.message };
    }
    
    if (!result.success) {
      return { valid: false, message: 'Product not found' };
    }
    
    const product = result.data;
    return {
      valid: true,
      product: {
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
        stock: product.stock,
        available: product.available
      }
    };
  } catch (error) {
    console.error('Error validating product:', error);
    return { 
      valid: false, 
      message: 'Unable to validate product at this time',
      error: error.message 
    };
  }
};

// Helper function to check product availability
const checkProductAvailability = async (items) => {
  try {
    const url = `${PRODUCTS_SERVICE_URL}/api/products/check-availability`;
    const result = await productsServiceBreaker.fire(url, {
      method: 'POST',
      body: JSON.stringify({ items })
    });
    
    if (result.fallback) {
      return { valid: false, fallback: true, message: result.message };
    }
    
    return {
      valid: result.success,
      data: result.data,
      message: result.message
    };
  } catch (error) {
    console.error('Error checking product availability:', error);
    return { 
      valid: false, 
      message: 'Unable to check product availability at this time',
      error: error.message 
    };
  }
};

// Get user's cart
app.get('/api/cart/:userId', (req, res) => {
  try {
    const userId = req.params.userId;
    const cart = getUserCart(userId);
    
    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching cart',
      error: error.message
    });
  }
});

// Add item to cart
app.post('/api/cart/add', async (req, res) => {
  try {
    const { userId, productId, quantity = 1 } = req.body;
    
    // Validation
    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Product ID are required'
      });
    }
    
    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      });
    }
    
    // Validate product exists and is available
    const productValidation = await validateProduct(productId);
    
    if (!productValidation.valid) {
      return res.status(productValidation.fallback ? 503 : 404).json({
        success: false,
        message: productValidation.message || 'Product validation failed'
      });
    }
    
    const product = productValidation.product;
    
    // Check if product is available and has enough stock
    if (!product.available || product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Product is not available or insufficient stock',
        availableStock: product.stock,
        requestedQuantity: quantity
      });
    }
    
    // Get user's cart
    const cart = getUserCart(userId);
    
    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(item => item.productId === productId);
    
    if (existingItemIndex !== -1) {
      // Update existing item quantity
      const existingItem = cart.items[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;
      
      // Check if new quantity exceeds available stock
      if (newQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: 'Total quantity exceeds available stock',
          currentCartQuantity: existingItem.quantity,
          requestedQuantity: quantity,
          availableStock: product.stock
        });
      }
      
      existingItem.quantity = newQuantity;
      existingItem.updatedAt = new Date();
    } else {
      // Add new item to cart
      const newItem = {
        id: Date.now(), // Simple ID generation
        productId: productId,
        productName: product.name,
        price: product.price,
        category: product.category,
        quantity: quantity,
        addedAt: new Date(),
        updatedAt: new Date()
      };
      
      cart.items.push(newItem);
    }
    
    // Recalculate cart totals
    calculateCartTotals(cart);
    
    res.json({
      success: true,
      message: 'Item added to cart successfully',
      data: cart
    });
    
  } catch (error) {
    console.error('Error adding item to cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding item to cart',
      error: error.message
    });
  }
});

// Update item quantity in cart
app.put('/api/cart/update', async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;
    
    // Validation
    if (!userId || !productId || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'User ID, Product ID, and quantity are required'
      });
    }
    
    if (quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity cannot be negative'
      });
    }
    
    const cart = getUserCart(userId);
    const itemIndex = cart.items.findIndex(item => item.productId === productId);
    
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }
    
    // If quantity is 0, remove item from cart
    if (quantity === 0) {
      cart.items.splice(itemIndex, 1);
      calculateCartTotals(cart);
      
      return res.json({
        success: true,
        message: 'Item removed from cart',
        data: cart
      });
    }
    
    // Validate product stock for new quantity
    const productValidation = await validateProduct(productId);
    
    if (!productValidation.valid) {
      return res.status(productValidation.fallback ? 503 : 404).json({
        success: false,
        message: productValidation.message || 'Product validation failed'
      });
    }
    
    const product = productValidation.product;
    
    if (!product.available || product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Product is not available or insufficient stock',
        availableStock: product.stock,
        requestedQuantity: quantity
      });
    }
    
    // Update item quantity
    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].updatedAt = new Date();
    
    // Recalculate cart totals
    calculateCartTotals(cart);
    
    res.json({
      success: true,
      message: 'Cart updated successfully',
      data: cart
    });
    
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating cart',
      error: error.message
    });
  }
});

// Remove item from cart
app.delete('/api/cart/remove/:itemId', (req, res) => {
  try {
    const { itemId } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const cart = getUserCart(userId);
    const itemIndex = cart.items.findIndex(item => item.id === parseInt(itemId));
    
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }
    
    const removedItem = cart.items.splice(itemIndex, 1)[0];
    calculateCartTotals(cart);
    
    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      removedItem: removedItem,
      data: cart
    });
    
  } catch (error) {
    console.error('Error removing item from cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing item from cart',
      error: error.message
    });
  }
});

// Clear entire cart
app.delete('/api/cart/clear/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    if (carts[userId]) {
      const itemCount = carts[userId].items.length;
      carts[userId].items = [];
      calculateCartTotals(carts[userId]);
      
      res.json({
        success: true,
        message: `Cart cleared successfully. ${itemCount} items removed.`,
        data: carts[userId]
      });
    } else {
      res.json({
        success: true,
        message: 'Cart was already empty',
        data: getUserCart(userId)
      });
    }
    
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing cart',
      error: error.message
    });
  }
});

// Validate cart items (for checkout)
app.post('/api/cart/validate/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const cart = getUserCart(userId);
    
    if (cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }
    
    // Prepare items for availability check
    const items = cart.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity
    }));
    
    // Check availability with Products service
    const availabilityCheck = await checkProductAvailability(items);
    
    if (!availabilityCheck.valid) {
      return res.status(availabilityCheck.fallback ? 503 : 400).json({
        success: false,
        message: availabilityCheck.message || 'Cart validation failed',
        fallback: availabilityCheck.fallback
      });
    }
    
    const { allAvailable, items: checkedItems } = availabilityCheck.data;
    
    // Update cart with latest product information
    const updatedItems = cart.items.map(cartItem => {
      const checkedItem = checkedItems.find(item => item.productId === cartItem.productId);
      if (checkedItem) {
        return {
          ...cartItem,
          price: checkedItem.price, // Update with latest price
          available: checkedItem.available,
          availableQuantity: checkedItem.availableQuantity
        };
      }
      return cartItem;
    });
    
    cart.items = updatedItems;
    calculateCartTotals(cart);
    
    res.json({
      success: true,
      message: allAvailable ? 'Cart is valid and ready for checkout' : 'Some items in cart are not available',
      data: {
        cart: cart,
        validation: {
          allAvailable: allAvailable,
          items: checkedItems
        }
      }
    });
    
  } catch (error) {
    console.error('Error validating cart:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating cart',
      error: error.message
    });
  }
});

// Get cart summary
app.get('/api/cart/:userId/summary', (req, res) => {
  try {
    const userId = req.params.userId;
    const cart = getUserCart(userId);
    
    const summary = {
      userId: userId,
      totalItems: cart.totalItems,
      totalAmount: cart.totalAmount,
      itemCount: cart.items.length,
      isEmpty: cart.items.length === 0,
      lastUpdated: cart.updatedAt
    };
    
    res.json({
      success: true,
      data: summary
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching cart summary',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Cart service is running',
    timestamp: new Date().toISOString(),
    totalCarts: Object.keys(carts).length,
    circuitBreaker: {
      productsService: {
        state: productsServiceBreaker.stats.state,
        requests: productsServiceBreaker.stats.requests,
        failures: productsServiceBreaker.stats.failures
      }
    }
  });
});

// Circuit breaker health endpoint
app.get('/api/health/circuit-breaker', (req, res) => {
  const stats = productsServiceBreaker.stats;
  res.json({
    success: true,
    circuitBreaker: {
      name: 'products-service',
      state: stats.state,
      requests: stats.requests,
      failures: stats.failures,
      fallbacks: stats.fallbacks,
      timeouts: stats.timeouts,
      isOpen: productsServiceBreaker.opened,
      isHalfOpen: productsServiceBreaker.halfOpen
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Cart Service API',
    endpoints: {
      getCart: 'GET /api/cart/:userId',
      addItem: 'POST /api/cart/add',
      updateItem: 'PUT /api/cart/update',
      removeItem: 'DELETE /api/cart/remove/:itemId?userId=:userId',
      clearCart: 'DELETE /api/cart/clear/:userId',
      validateCart: 'POST /api/cart/validate/:userId',
      cartSummary: 'GET /api/cart/:userId/summary',
      health: 'GET /api/health',
      circuitBreakerHealth: 'GET /api/health/circuit-breaker'
    },
    features: [
      'Product validation with Products service',
      'Circuit breaker pattern for resilience',
      'Inventory checking before adding items',
      'Real-time cart total calculations',
      'Fallback handling for service unavailability'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Cart Service Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🛒 Cart service running on port ${PORT}`);
  console.log(`📡 Products service URL: ${PRODUCTS_SERVICE_URL}`);
  console.log(`🔄 Circuit breaker enabled for Products service`);
  console.log(`Available endpoints:`);
  console.log(`- GET /api/cart/:userId (get user's cart)`);
  console.log(`- POST /api/cart/add (add item to cart)`);
  console.log(`- PUT /api/cart/update (update item quantity)`);
  console.log(`- DELETE /api/cart/remove/:itemId (remove item from cart)`);
  console.log(`- DELETE /api/cart/clear/:userId (clear entire cart)`);
  console.log(`- POST /api/cart/validate/:userId (validate cart for checkout)`);
  console.log(`- GET /api/cart/:userId/summary (get cart summary)`);
  console.log(`- GET /api/health (health check)`);
  console.log(`- GET /api/health/circuit-breaker (circuit breaker status)`);
});

module.exports = app;