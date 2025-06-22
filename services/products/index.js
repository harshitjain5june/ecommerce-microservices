const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3002;

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// Mock products database
let products = [
  {
    id: 1,
    name: "iPhone 15 Pro",
    description: "Latest iPhone with advanced camera system and A17 Pro chip",
    price: 999.99,
    category: "Electronics",
    stock: 50,
    available: true,
    image: "https://example.com/iphone15pro.jpg",
    brand: "Apple",
    rating: 4.8,
    reviews: 1250,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15')
  },
  {
    id: 2,
    name: "Samsung Galaxy S24",
    description: "Premium Android smartphone with AI features",
    price: 899.99,
    category: "Electronics",
    stock: 35,
    available: true,
    image: "https://example.com/galaxys24.jpg",
    brand: "Samsung",
    rating: 4.6,
    reviews: 890,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10')
  },
  {
    id: 3,
    name: "MacBook Pro 14-inch",
    description: "Professional laptop with M3 chip for power users",
    price: 1999.99,
    category: "Electronics",
    stock: 20,
    available: true,
    image: "https://example.com/macbookpro.jpg",
    brand: "Apple",
    rating: 4.9,
    reviews: 567,
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-05')
  },
  {
    id: 4,
    name: "Nike Air Max 270",
    description: "Comfortable running shoes with Air Max technology",
    price: 129.99,
    category: "Sports",
    stock: 100,
    available: true,
    image: "https://example.com/nikeairmax.jpg",
    brand: "Nike",
    rating: 4.5,
    reviews: 2340,
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20')
  },
  {
    id: 5,
    name: "Adidas Ultraboost 22",
    description: "Premium running shoes with Boost midsole",
    price: 179.99,
    category: "Sports",
    stock: 75,
    available: true,
    image: "https://example.com/adidasultraboost.jpg",
    brand: "Adidas",
    rating: 4.7,
    reviews: 1890,
    createdAt: new Date('2024-01-18'),
    updatedAt: new Date('2024-01-18')
  },
  {
    id: 6,
    name: "Sony WH-1000XM5",
    description: "Wireless noise-canceling headphones",
    price: 349.99,
    category: "Electronics",
    stock: 30,
    available: true,
    image: "https://example.com/sonyheadphones.jpg",
    brand: "Sony",
    rating: 4.8,
    reviews: 1120,
    createdAt: new Date('2024-01-12'),
    updatedAt: new Date('2024-01-12')
  },
  {
    id: 7,
    name: "Levi's 501 Original Jeans",
    description: "Classic straight-fit jeans in blue denim",
    price: 59.99,
    category: "Clothing",
    stock: 200,
    available: true,
    image: "https://example.com/levis501.jpg",
    brand: "Levi's",
    rating: 4.4,
    reviews: 3450,
    createdAt: new Date('2024-01-25'),
    updatedAt: new Date('2024-01-25')
  },
  {
    id: 8,
    name: "Canon EOS R6 Mark II",
    description: "Full-frame mirrorless camera for professionals",
    price: 2499.99,
    category: "Electronics",
    stock: 15,
    available: true,
    image: "https://example.com/canoneosr6.jpg",
    brand: "Canon",
    rating: 4.9,
    reviews: 234,
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date('2024-01-08')
  },
  {
    id: 9,
    name: "Out of Stock Product",
    description: "This product is out of stock for testing",
    price: 99.99,
    category: "Test",
    stock: 0,
    available: false,
    image: "https://example.com/outofstock.jpg",
    brand: "Test Brand",
    rating: 4.0,
    reviews: 10,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  {
    id: 10,
    name: "Low Stock Product",
    description: "This product has low stock for testing",
    price: 49.99,
    category: "Test",
    stock: 2,
    available: true,
    image: "https://example.com/lowstock.jpg",
    brand: "Test Brand",
    rating: 4.2,
    reviews: 25,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02')
  }
];

// Middleware to verify JWT token (optional for some endpoints)
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN

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
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Helper function to search products
const searchProducts = (query, category, minPrice, maxPrice, inStock) => {
  let filteredProducts = [...products];

  // Search by name or description
  if (query) {
    const searchTerm = query.toLowerCase();
    filteredProducts = filteredProducts.filter(product =>
      product.name.toLowerCase().includes(searchTerm) ||
      product.description.toLowerCase().includes(searchTerm) ||
      product.brand.toLowerCase().includes(searchTerm)
    );
  }

  // Filter by category
  if (category) {
    filteredProducts = filteredProducts.filter(product =>
      product.category.toLowerCase() === category.toLowerCase()
    );
  }

  // Filter by price range
  if (minPrice !== undefined) {
    filteredProducts = filteredProducts.filter(product => product.price >= minPrice);
  }
  if (maxPrice !== undefined) {
    filteredProducts = filteredProducts.filter(product => product.price <= maxPrice);
  }

  // Filter by stock availability
  if (inStock === 'true') {
    filteredProducts = filteredProducts.filter(product => product.stock > 0 && product.available);
  }

  return filteredProducts;
};

// Get all products
app.get('/api/products', (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = 'name', 
      order = 'asc',
      category,
      minPrice,
      maxPrice,
      inStock
    } = req.query;

    let filteredProducts = searchProducts(null, category, minPrice, maxPrice, inStock);

    // Sorting
    filteredProducts.sort((a, b) => {
      let aValue = a[sort];
      let bValue = b[sort];
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (order === 'desc') {
        return bValue > aValue ? 1 : -1;
      }
      return aValue > bValue ? 1 : -1;
    });

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        products: paginatedProducts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(filteredProducts.length / limit),
          totalProducts: filteredProducts.length,
          hasNextPage: endIndex < filteredProducts.length,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

// Search products
app.get('/api/products/search', (req, res) => {
  try {
    const { 
      q: query, 
      category, 
      minPrice, 
      maxPrice, 
      inStock,
      page = 1, 
      limit = 10 
    } = req.query;

    if (!query && !category && minPrice === undefined && maxPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: 'At least one search parameter is required'
      });
    }

    let filteredProducts = searchProducts(query, category, minPrice, maxPrice, inStock);

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        products: paginatedProducts,
        searchQuery: query,
        filters: { category, minPrice, maxPrice, inStock },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(filteredProducts.length / limit),
          totalProducts: filteredProducts.length,
          hasNextPage: endIndex < filteredProducts.length,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching products',
      error: error.message
    });
  }
});

// Get product by ID
app.get('/api/products/:id', (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const product = products.find(p => p.id === productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
});

// Get products by category
app.get('/api/products/category/:category', (req, res) => {
  try {
    const category = req.params.category;
    const { page = 1, limit = 10 } = req.query;

    const categoryProducts = products.filter(product =>
      product.category.toLowerCase() === category.toLowerCase() && product.available
    );

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedProducts = categoryProducts.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        category: category,
        products: paginatedProducts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(categoryProducts.length / limit),
          totalProducts: categoryProducts.length,
          hasNextPage: endIndex < categoryProducts.length,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching products by category',
      error: error.message
    });
  }
});

// Get all categories
app.get('/api/categories', (req, res) => {
  try {
    const categories = [...new Set(products.map(product => product.category))];
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
});

// Check product availability (for inventory validation)
app.post('/api/products/check-availability', (req, res) => {
  try {
    const { items } = req.body; // items: [{ productId, quantity }]

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required'
      });
    }

    const availabilityResults = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      
      if (!product) {
        return {
          productId: item.productId,
          available: false,
          message: 'Product not found',
          requestedQuantity: item.quantity,
          availableQuantity: 0
        };
      }

      const available = product.available && product.stock >= item.quantity;
      
      return {
        productId: item.productId,
        productName: product.name,
        available: available,
        message: available ? 'Product available' : 'Insufficient stock',
        requestedQuantity: item.quantity,
        availableQuantity: product.stock,
        price: product.price
      };
    });

    const allAvailable = availabilityResults.every(result => result.available);

    res.json({
      success: true,
      data: {
        allAvailable: allAvailable,
        items: availabilityResults
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking product availability',
      error: error.message
    });
  }
});

// Update product stock (for order processing)
app.put('/api/products/:id/stock', verifyToken, (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { quantity, operation = 'decrease' } = req.body; // operation: 'decrease' or 'increase'

    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required'
      });
    }

    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const product = products[productIndex];
    
    if (operation === 'decrease') {
      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock',
          availableStock: product.stock,
          requestedQuantity: quantity
        });
      }
      product.stock -= quantity;
    } else if (operation === 'increase') {
      product.stock += quantity;
    }

    // Update availability status
    product.available = product.stock > 0;
    product.updatedAt = new Date();

    res.json({
      success: true,
      message: `Stock ${operation}d successfully`,
      data: {
        productId: product.id,
        productName: product.name,
        newStock: product.stock,
        available: product.available
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating product stock',
      error: error.message
    });
  }
});

// Admin endpoints (protected)
app.post('/api/products', verifyToken, (req, res) => {
  try {
    const { name, description, price, category, stock, image, brand } = req.body;

    // Basic validation
    if (!name || !description || !price || !category || stock === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, price, category, and stock are required'
      });
    }

    const newProduct = {
      id: products.length + 1,
      name,
      description,
      price: parseFloat(price),
      category,
      stock: parseInt(stock),
      available: stock > 0,
      image: image || 'https://example.com/default-product.jpg',
      brand: brand || 'Generic',
      rating: 0,
      reviews: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    products.push(newProduct);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: newProduct
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
});

app.put('/api/products/:id', verifyToken, (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const updatedFields = req.body;
    updatedFields.updatedAt = new Date();

    // Update availability based on stock
    if (updatedFields.stock !== undefined) {
      updatedFields.available = updatedFields.stock > 0;
    }

    products[productIndex] = { ...products[productIndex], ...updatedFields };

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: products[productIndex]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
});

app.delete('/api/products/:id', verifyToken, (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const deletedProduct = products.splice(productIndex, 1)[0];

    res.json({
      success: true,
      message: 'Product deleted successfully',
      data: deletedProduct
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Products service is running',
    timestamp: new Date().toISOString(),
    totalProducts: products.length,
    availableProducts: products.filter(p => p.available).length
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Products Service API',
    endpoints: {
      getAllProducts: 'GET /api/products',
      searchProducts: 'GET /api/products/search',
      getProductById: 'GET /api/products/:id',
      getProductsByCategory: 'GET /api/products/category/:category',
      getCategories: 'GET /api/categories',
      checkAvailability: 'POST /api/products/check-availability',
      updateStock: 'PUT /api/products/:id/stock (requires auth)',
      createProduct: 'POST /api/products (requires auth)',
      updateProduct: 'PUT /api/products/:id (requires auth)',
      deleteProduct: 'DELETE /api/products/:id (requires auth)',
      health: 'GET /api/health'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Products service running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`- GET /api/products (with pagination, filtering, sorting)`);
  console.log(`- GET /api/products/search (search functionality)`);
  console.log(`- GET /api/products/:id (get product by ID)`);
  console.log(`- GET /api/products/category/:category (products by category)`);
  console.log(`- GET /api/categories (all categories)`);
  console.log(`- POST /api/products/check-availability (inventory check)`);
  console.log(`- PUT /api/products/:id/stock (update stock - requires auth)`);
  console.log(`- POST /api/products (create product - requires auth)`);
  console.log(`- PUT /api/products/:id (update product - requires auth)`);
  console.log(`- DELETE /api/products/:id (delete product - requires auth)`);
  console.log(`- GET /api/health (health check)`);
});

module.exports = app; 