const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// JWT Secret (should match the one used in services)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Service URLs (in production, these would be environment variables)
const SERVICE_URLS = {
  users: process.env.USERS_SERVICE_URL || 'http://localhost:3001',
  products: process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3002',
  cart: process.env.CART_SERVICE_URL || 'http://localhost:3003',
  orders: process.env.ORDERS_SERVICE_URL || 'http://localhost:3004',
  notifications: process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:3005'
};

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API Gateway is running',
    timestamp: new Date().toISOString(),
    services: Object.keys(SERVICE_URLS)
  });
});

// Service health check endpoint
app.get('/api/health/services', async (req, res) => {
  const healthChecks = {};
  
  for (const [serviceName, serviceUrl] of Object.entries(SERVICE_URLS)) {
    try {
      const response = await fetch(`${serviceUrl}/api/health`);
      const data = await response.json();
      healthChecks[serviceName] = {
        status: 'healthy',
        data: data
      };
    } catch (error) {
      healthChecks[serviceName] = {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  res.json({
    success: true,
    message: 'Service health check completed',
    timestamp: new Date().toISOString(),
    services: healthChecks
  });
});

// Users Service Routes
app.use('/api/auth', createProxyMiddleware({
  target: SERVICE_URLS.users,
  changeOrigin: true,
  pathRewrite: {
    '^/api/auth': '/api'
  },
  logLevel: 'silent'
}));

// Products Service Routes (public endpoints)
app.use('/api/products', createProxyMiddleware({
  target: SERVICE_URLS.products,
  changeOrigin: true,
  logLevel: 'silent'
}));

// Products Service Routes (protected endpoints)
app.use('/api/admin/products', authenticateToken, createProxyMiddleware({
  target: SERVICE_URLS.products,
  changeOrigin: true,
  pathRewrite: {
    '^/api/admin/products': '/api/products'
  },
  logLevel: 'silent'
}));

// Cart Service Routes (authenticated)
app.use('/api/cart', authenticateToken, createProxyMiddleware({
  target: SERVICE_URLS.cart,
  changeOrigin: true,
  logLevel: 'silent'
}));

// Orders Service Routes (authenticated)
app.use('/api/orders', authenticateToken, createProxyMiddleware({
  target: SERVICE_URLS.orders,
  changeOrigin: true,
  logLevel: 'silent'
}));

// Notifications Service Routes (authenticated)
app.use('/api/notifications', authenticateToken, createProxyMiddleware({
  target: SERVICE_URLS.notifications,
  changeOrigin: true,
  logLevel: 'silent'
}));

// Root endpoint with API documentation
app.get('/', (req, res) => {
  res.json({
    message: 'eCommerce API Gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: 'GET /api/health',
      serviceHealth: 'GET /api/health/services',
      auth: {
        login: 'POST /api/auth/login',
        loginWithEmail: 'POST /api/auth/login/email',
        profile: 'GET /api/auth/profile',
        verifyToken: 'POST /api/auth/verify-token'
      },
      products: {
        getAll: 'GET /api/products',
        search: 'GET /api/products/search',
        getById: 'GET /api/products/:id',
        getByCategory: 'GET /api/products/category/:category',
        getCategories: 'GET /api/categories',
        checkAvailability: 'POST /api/products/check-availability'
      },
      admin: {
        createProduct: 'POST /api/admin/products',
        updateProduct: 'PUT /api/admin/products/:id',
        deleteProduct: 'DELETE /api/admin/products/:id',
        updateStock: 'PUT /api/admin/products/:id/stock'
      },
      cart: {
        getCart: 'GET /api/cart/:userId',
        addItem: 'POST /api/cart/add',
        updateItem: 'PUT /api/cart/update',
        removeItem: 'DELETE /api/cart/remove/:itemId',
        clearCart: 'DELETE /api/cart/clear/:userId'
      },
      orders: {
        getOrders: 'GET /api/orders/:userId',
        getOrder: 'GET /api/orders/:orderId',
        updateStatus: 'PUT /api/orders/:orderId/status'
      },
      notifications: {
        getNotifications: 'GET /api/notifications/:userId',
        sendNotification: 'POST /api/notifications/send'
      }
    },
    services: Object.keys(SERVICE_URLS)
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('API Gateway Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📡 Service URLs:`);
  Object.entries(SERVICE_URLS).forEach(([service, url]) => {
    console.log(`   ${service}: ${url}`);
  });
  console.log(`🔐 Authentication: Centralized JWT validation`);
  console.log(`🛡️  Security: Rate limiting, CORS, Helmet enabled`);
  console.log(`📊 Monitoring: Request logging enabled`);
});

module.exports = app; 