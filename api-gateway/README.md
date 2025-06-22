# API Gateway - eCommerce Backend

The API Gateway serves as the central entry point for all eCommerce microservices, providing authentication, routing, security, and orchestration capabilities.

## 🏗️ **Architecture Overview**

```
Client → API Gateway (Auth + Routing) → Microservices
```

### **Authentication Strategy**
- **Centralized JWT Validation**: All authentication happens at the gateway level
- **Service Decoupling**: Individual services don't handle authentication
- **Performance**: JWT validation occurs once per request
- **Security**: Uniform auth policies across all services

## 🚀 **Features**

### **Core Functionality**
- **Service Routing**: Routes requests to appropriate microservices
- **Authentication**: Centralized JWT token validation
- **Request/Response Logging**: Comprehensive request tracking
- **Error Handling**: Unified error responses
- **Health Monitoring**: Service health checks

### **Security Features**
- **Rate Limiting**: Prevents abuse (100 requests per 15 minutes)
- **CORS Support**: Cross-origin resource sharing
- **Helmet**: Security headers protection
- **Request Size Limits**: Prevents large payload attacks

### **Service Integration**
- **Users Service**: Authentication and user management
- **Products Service**: Product catalog and search
- **Cart Service**: Shopping cart management
- **Orders Service**: Order processing
- **Notifications Service**: User notifications

## 📡 **API Endpoints**

### **Gateway Health**
- `GET /api/health` - Gateway health check
- `GET /api/health/services` - All services health status

### **Authentication (Users Service)**
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/login/email` - Login with email/password
- `GET /api/auth/profile` - Get user profile (requires auth)
- `POST /api/auth/verify-token` - Verify JWT token

### **Products (Public)**
- `GET /api/products` - Get all products with pagination/filtering
- `GET /api/products/search` - Search products
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/category/:category` - Get products by category
- `GET /api/categories` - Get all categories
- `POST /api/products/check-availability` - Check inventory

### **Products (Admin - Protected)**
- `POST /api/admin/products` - Create new product
- `PUT /api/admin/products/:id` - Update product
- `DELETE /api/admin/products/:id` - Delete product
- `PUT /api/admin/products/:id/stock` - Update product stock

### **Cart (Protected)**
- `GET /api/cart/:userId` - Get user's cart
- `POST /api/cart/add` - Add item to cart
- `PUT /api/cart/update` - Update cart item
- `DELETE /api/cart/remove/:itemId` - Remove item from cart
- `DELETE /api/cart/clear/:userId` - Clear entire cart

### **Orders (Protected)**
- `GET /api/orders/:userId` - Get user's orders
- `GET /api/orders/:orderId` - Get specific order
- `PUT /api/orders/:orderId/status` - Update order status

### **Notifications (Protected)**
- `GET /api/notifications/:userId` - Get user notifications
- `POST /api/notifications/send` - Send notification

## 🔧 **Installation & Running**

### **Prerequisites**
Make sure all microservices are running:
- Users Service: Port 3001
- Products Service: Port 3002
- Cart Service: Port 3003
- Orders Service: Port 3004
- Notifications Service: Port 3005

### **Local Development**

1. Install dependencies:
```bash
npm install
```

2. Start the gateway:
```bash
npm start
```

3. For development with auto-restart:
```bash
npm run dev
```

### **Docker**

1. Build and run with Docker:
```bash
docker build -t api-gateway .
docker run -p 3000:3000 api-gateway
```

The gateway will run on port 3000 by default.

## 🌍 **Environment Variables**

- `PORT`: Gateway port (default: 3000)
- `JWT_SECRET`: Secret key for JWT validation (must match services)
- `USERS_SERVICE_URL`: Users service URL (default: http://localhost:3001)
- `PRODUCTS_SERVICE_URL`: Products service URL (default: http://localhost:3002)
- `CART_SERVICE_URL`: Cart service URL (default: http://localhost:3003)
- `ORDERS_SERVICE_URL`: Orders service URL (default: http://localhost:3004)
- `NOTIFICATIONS_SERVICE_URL`: Notifications service URL (default: http://localhost:3005)

## 🔐 **Authentication Flow**

### **Login Process**
1. Client sends credentials to `/api/auth/login`
2. Gateway forwards to Users Service
3. Users Service validates and returns JWT token
4. Gateway returns token to client

### **Protected Request Flow**
1. Client includes JWT token in Authorization header
2. Gateway validates JWT token
3. If valid, forwards request to appropriate service
4. Service processes request and returns response
5. Gateway returns response to client

### **Token Format**
```
Authorization: Bearer <jwt-token>
```

## 📊 **Request Flow Examples**

### **Public Product Search**
```
Client → API Gateway → Products Service → Response
```

### **Protected Cart Operation**
```
Client → API Gateway (JWT Validation) → Cart Service → Response
```

### **Admin Product Creation**
```
Client → API Gateway (JWT Validation) → Products Service → Response
```

## 🛡️ **Security Features**

### **Rate Limiting**
- 100 requests per 15 minutes per IP
- Configurable limits
- Custom error responses

### **CORS Configuration**
- Cross-origin requests enabled
- Configurable origins
- Preflight request handling

### **Security Headers (Helmet)**
- XSS Protection
- Content Security Policy
- Frame Options
- Content Type Options

### **Request Validation**
- JSON payload size limits
- URL-encoded data limits
- Malformed request handling

## 📝 **Logging & Monitoring**

### **Request Logging**
- HTTP method and path
- Response status codes
- Request timing
- Service routing information

### **Health Monitoring**
- Gateway health status
- Individual service health checks
- Service availability monitoring

### **Error Tracking**
- Detailed error logging
- Service failure detection
- Error response formatting

## 🔄 **Service Communication**

### **Proxy Configuration**
- Automatic request forwarding
- Path rewriting
- Header preservation
- Response streaming

### **Service Discovery**
- Hardcoded service URLs (for simplicity)
- Environment variable configuration
- Health check integration

### **Load Balancing**
- Single service instance per type
- Future: Multiple instances support
- Health-based routing

## 🚨 **Error Handling**

### **Common Error Responses**

#### **Authentication Required (401)**
```json
{
  "success": false,
  "message": "Access token required"
}
```

#### **Invalid Token (403)**
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

#### **Rate Limit Exceeded (429)**
```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again later."
}
```

#### **Service Unavailable (503)**
```json
{
  "success": false,
  "message": "Service temporarily unavailable"
}
```

#### **Endpoint Not Found (404)**
```json
{
  "success": false,
  "message": "Endpoint not found",
  "path": "/api/invalid-endpoint",
  "method": "GET"
}
```

## 🧪 **Testing Examples**

### **Health Check**
```bash
curl "http://localhost:3000/api/health"
```

### **Service Health Check**
```bash
curl "http://localhost:3000/api/health/services"
```

### **Login**
```bash
curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

### **Get Products (Public)**
```bash
curl "http://localhost:3000/api/products?limit=5"
```

### **Get Products (Protected)**
```bash
curl "http://localhost:3000/api/products" \
  -H "Authorization: Bearer <your-jwt-token>"
```

### **Create Product (Admin)**
```bash
curl -X POST "http://localhost:3000/api/admin/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{"name":"Test Product","description":"Test","price":99.99,"category":"Test","stock":10}'
```

## 🔧 **Configuration**

### **Rate Limiting Configuration**
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // requests per window
  message: { success: false, message: 'Rate limit exceeded' }
});
```

### **CORS Configuration**
```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
```

### **Security Headers**
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  }
}));
```

## 🚀 **Production Considerations**

### **Security**
- Use environment variables for sensitive data
- Implement HTTPS
- Configure proper CORS origins
- Set up monitoring and alerting

### **Performance**
- Implement caching (Redis)
- Add load balancing
- Use connection pooling
- Monitor response times

### **Scalability**
- Horizontal scaling support
- Service discovery integration
- Circuit breaker patterns
- Graceful degradation

### **Monitoring**
- Application performance monitoring
- Error tracking and alerting
- Request/response logging
- Service health dashboards

## 🔗 **Integration with Services**

The API Gateway integrates with all eCommerce microservices:

1. **Users Service**: Authentication and user management
2. **Products Service**: Product catalog and inventory
3. **Cart Service**: Shopping cart operations
4. **Orders Service**: Order processing and management
5. **Notifications Service**: User notification handling

Each service maintains its own business logic while the gateway handles cross-cutting concerns like authentication, routing, and security. 