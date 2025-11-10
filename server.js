import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Use environment variable - falls back to .env file
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Server is running!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    stripe_configured: !!process.env.STRIPE_SECRET_KEY
  });
});

// Test Stripe connection
app.get('/test-stripe', async (req, res) => {
  try {
    // Check if Stripe key is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(400).json({ 
        status: 'Stripe connection failed',
        error: 'STRIPE_SECRET_KEY environment variable is not set' 
      });
    }
    
    const balance = await stripe.balance.retrieve();
    res.json({ 
      status: 'Stripe connection successful',
      balance: balance
    });
  } catch (error) {
    res.status(400).json({ 
      status: 'Stripe connection failed',
      error: error.message 
    });
  }
});

// Create Payment Intent
app.post('/create-payment-intent', async (req, res) => {
  try {
    // Check if Stripe key is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(400).json({ 
        error: 'Stripe is not configured properly. Please check environment variables.' 
      });
    }

    const { amount, currency = 'eur' } = req.body;

    console.log('Received request to create payment intent:', { amount, currency });

    // Validate amount
    if (!amount || amount < 1) {
      return res.status(400).json({ 
        error: 'Invalid amount. Amount must be at least 1 EUR.' 
      });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log('✅ Payment intent created successfully:', paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });

  } catch (error) {
    console.error('❌ Stripe API Error:', error.message);
    
    res.status(400).json({ 
      error: `Payment error: ${error.message}`
    });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle all other routes
app.get('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Stripe configured: ${!!process.env.STRIPE_SECRET_KEY}`);
  console.log(`📊 Visit: http://localhost:${PORT}`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Stripe test: http://localhost:${PORT}/test-stripe`);
});