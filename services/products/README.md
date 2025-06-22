# Products Service - eCommerce Backend

This service provides comprehensive product catalog management for the eCommerce backend, including search, filtering, inventory management, and admin operations.

## Features

- **Product Catalog**: Complete product management with rich data
- **Advanced Search**: Search by name, description, brand with multiple filters
- **Category Management**: Browse products by category
- **Inventory Tracking**: Real-time stock management and availability
- **Pagination & Sorting**: Efficient data retrieval with sorting options
- **Admin Operations**: Protected endpoints for product management
- **JWT Authentication**: Secure admin operations
- **Health Monitoring**: Service health checks and statistics

## Pre-defined Products

The service comes with 10 sample products across different categories:

| Category | Products |
|----------|----------|
| **Electronics** | iPhone 15 Pro, Samsung Galaxy S24, MacBook Pro, Sony Headphones, Canon Camera |
| **Sports** | Nike Air Max 270, Adidas Ultraboost 22 |
| **Clothing** | Levi's 501 Jeans |
| **Test** | Out of Stock Product, Low Stock Product |

## API Endpoints

### 1. Get All Products
**GET** `/api/products`

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)
- `sort` (string): Sort field (name, price, rating, createdAt)
- `order` (string): Sort order (asc, desc)
- `category` (string): Filter by category
- `minPrice` (number): Minimum price filter
- `maxPrice` (number): Maximum price filter
- `inStock` (boolean): Filter in-stock products only

**Example:**
```bash
curl "http://localhost:3002/api/products?page=1&limit=5&sort=price&order=desc&category=Electronics"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalProducts": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### 2. Search Products
**GET** `/api/products/search`

**Query Parameters:**
- `q` (string): Search query (name, description, brand)
- `category` (string): Filter by category
- `minPrice` (number): Minimum price
- `maxPrice` (number): Maximum price
- `inStock` (boolean): In-stock only
- `page` (number): Page number
- `limit` (number): Items per page

**Example:**
```bash
curl "http://localhost:3002/api/products/search?q=iPhone&category=Electronics&minPrice=500&maxPrice=1500"
```

### 3. Get Product by ID
**GET** `/api/products/:id`

**Example:**
```bash
curl "http://localhost:3002/api/products/1"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "iPhone 15 Pro",
    "description": "Latest iPhone with advanced camera system",
    "price": 999.99,
    "category": "Electronics",
    "stock": 50,
    "available": true,
    "brand": "Apple",
    "rating": 4.8,
    "reviews": 1250
  }
}
```

### 4. Get Products by Category
**GET** `/api/products/category/:category`

**Example:**
```bash
curl "http://localhost:3002/api/products/category/Electronics?page=1&limit=5"
```

### 5. Get All Categories
**GET** `/api/categories`

**Response:**
```json
{
  "success": true,
  "data": ["Electronics", "Sports", "Clothing", "Test"]
}
```

### 6. Check Product Availability (Inventory Validation)
**POST** `/api/products/check-availability`

**Request Body:**
```json
{
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 4, "quantity": 1 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "allAvailable": true,
    "items": [
      {
        "productId": 1,
        "productName": "iPhone 15 Pro",
        "available": true,
        "message": "Product available",
        "requestedQuantity": 2,
        "availableQuantity": 50,
        "price": 999.99
      }
    ]
  }
}
```

### 7. Update Product Stock (Protected)
**PUT** `/api/products/:id/stock`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Request Body:**
```json
{
  "quantity": 5,
  "operation": "decrease"  // "decrease" or "increase"
}
```

### 8. Create Product (Protected - Admin)
**POST** `/api/products`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Request Body:**
```json
{
  "name": "New Product",
  "description": "Product description",
  "price": 99.99,
  "category": "Electronics",
  "stock": 100,
  "brand": "Brand Name",
  "image": "https://example.com/image.jpg"
}
```

### 9. Update Product (Protected - Admin)
**PUT** `/api/products/:id`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Request Body:**
```json
{
  "name": "Updated Product Name",
  "price": 149.99,
  "stock": 75
}
```

### 10. Delete Product (Protected - Admin)
**DELETE** `/api/products/:id`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

### 11. Health Check
**GET** `/api/health`

**Response:**
```json
{
  "success": true,
  "message": "Products service is running",
  "timestamp": "2024-01-21T10:30:00.000Z",
  "totalProducts": 10,
  "availableProducts": 8
}
```

## Installation & Running

### Option 1: Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the service:
```bash
npm start
```

3. For development with auto-restart:
```bash
npm run dev
```

### Option 2: Docker

1. Build and run with Docker:
```bash
docker build -t products-service .
docker run -p 3002:3002 products-service
```

The service will run on port 3002 by default (configurable via PORT environment variable).

## Environment Variables

- `PORT`: Service port (default: 3002)
- `JWT_SECRET`: Secret key for JWT tokens (default: demo key)

## Product Data Structure

```json
{
  "id": "number",
  "name": "string",
  "description": "string",
  "price": "number",
  "category": "string",
  "stock": "number",
  "available": "boolean",
  "image": "string",
  "brand": "string",
  "rating": "number",
  "reviews": "number",
  "createdAt": "date",
  "updatedAt": "date"
}
```

## Search & Filtering Features

### Text Search
- Searches in product name, description, and brand
- Case-insensitive matching
- Partial word matching

### Price Filtering
- `minPrice`: Filter products above minimum price
- `maxPrice`: Filter products below maximum price
- Can be used together for price range

### Category Filtering
- Filter by exact category name
- Case-insensitive matching

### Stock Filtering
- `inStock=true`: Show only available products
- `inStock=false`: Show all products including out-of-stock

### Sorting Options
- `name`: Sort by product name
- `price`: Sort by price
- `rating`: Sort by rating
- `createdAt`: Sort by creation date
- `order`: `asc` or `desc`

## Error Responses

### Product Not Found (404)
```json
{
  "success": false,
  "message": "Product not found"
}
```

### Invalid Request (400)
```json
{
  "success": false,
  "message": "At least one search parameter is required"
}
```

### Insufficient Stock (400)
```json
{
  "success": false,
  "message": "Insufficient stock",
  "availableStock": 5,
  "requestedQuantity": 10
}
```

### Authentication Required (401)
```json
{
  "success": false,
  "message": "Access token required"
}
```

## Testing Examples

### Search for Electronics
```bash
curl "http://localhost:3002/api/products/search?q=phone&category=Electronics"
```

### Get Products with Price Filter
```bash
curl "http://localhost:3002/api/products?minPrice=100&maxPrice=1000&sort=price&order=asc"
```

### Check Inventory for Order
```bash
curl -X POST "http://localhost:3002/api/products/check-availability" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":1,"quantity":2},{"productId":4,"quantity":1}]}'
```

### Create New Product (with auth)
```bash
curl -X POST "http://localhost:3002/api/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{"name":"Test Product","description":"Test","price":99.99,"category":"Test","stock":10}'
```

## Integration with Other Services

This service integrates with:
- **Orders Service**: Inventory validation and stock updates
- **Cart Service**: Product information for cart items
- **Users Service**: Authentication for admin operations

## Security Notes

⚠️ **Important**: This is a mock implementation for demonstration purposes:
- Products are stored in memory (reset on restart)
- JWT secret is hardcoded (use environment variable in production)
- No database persistence
- No image upload functionality

For production use, implement:
- Database persistence (MongoDB/PostgreSQL)
- Image upload and storage
- Input validation and sanitization
- Rate limiting
- Caching (Redis) 