/**
 * H2A-PQC Database Configuration
 * ===============================
 * MongoDB connection management with retry logic and event handling.
 */

import mongoose from 'mongoose';
import pino from 'pino';

const logger = pino({ name: 'database' });

/**
 * Database configuration
 */
const config = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/h2a_pqc',
  options: {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    retryReads: true,
  },
  retryAttempts: 5,
  retryDelayMs: 3000,
};

/**
 * Connection state
 */
let isConnected = false;
let connectionAttempts = 0;

/**
 * Connect to MongoDB with retry logic
 */
export async function connectDatabase() {
  if (isConnected) {
    logger.info('Already connected to MongoDB');
    return mongoose.connection;
  }

  while (connectionAttempts < config.retryAttempts) {
    try {
      connectionAttempts++;
      logger.info(`Connecting to MongoDB (attempt ${connectionAttempts}/${config.retryAttempts})...`);
      
      await mongoose.connect(config.uri, config.options);
      
      isConnected = true;
      connectionAttempts = 0;
      logger.info('Successfully connected to MongoDB');
      
      return mongoose.connection;
    } catch (error) {
      logger.error(`MongoDB connection failed: ${error.message}`);
      
      if (connectionAttempts >= config.retryAttempts) {
        logger.error('Max retry attempts reached. Giving up.');
        throw error;
      }
      
      logger.info(`Retrying in ${config.retryDelayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, config.retryDelayMs));
    }
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectDatabase() {
  if (!isConnected) {
    logger.info('Not connected to MongoDB');
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error(`Error disconnecting from MongoDB: ${error.message}`);
    throw error;
  }
}

/**
 * Get connection status
 */
export function getConnectionStatus() {
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
    readyStateText: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
    host: mongoose.connection.host,
    name: mongoose.connection.name,
  };
}

/**
 * Setup connection event handlers
 */
export function setupConnectionHandlers() {
  mongoose.connection.on('connected', () => {
    isConnected = true;
    logger.info('MongoDB connection established');
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('MongoDB connection lost');
  });

  mongoose.connection.on('error', (error) => {
    logger.error(`MongoDB connection error: ${error.message}`);
  });

  mongoose.connection.on('reconnected', () => {
    isConnected = true;
    logger.info('MongoDB reconnected');
  });

  // Handle process termination
  process.on('SIGINT', async () => {
    await disconnectDatabase();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

export default {
  connectDatabase,
  disconnectDatabase,
  getConnectionStatus,
  setupConnectionHandlers,
  config,
};
