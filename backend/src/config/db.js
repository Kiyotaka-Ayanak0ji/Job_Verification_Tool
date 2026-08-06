import mongoose from "mongoose";
import { env } from "./env.js";

let _connected = false;

export async function connectMongo() {
  if (_connected) {
    console.log("[mongo] already connected");
    return;
  }

  mongoose.set("strictQuery", true);

  // Connection options for production reliability
  const options = {
    maxPoolSize: 10,           // Maximum connections in the pool
    minPoolSize: 2,            // Minimum connections to maintain
    maxIdleTimeMS: 30000,      // Close connections after 30s of inactivity
    serverSelectionTimeoutMS: 5000, // Timeout for server selection
    socketTimeoutMS: 45000,    // Socket timeout
    heartbeatFrequencyMS: 10000, // Heartbeat to detect stale connections
    retryWrites: true,         // Retry writes on transient errors
    retryReads: true,          // Retry reads on transient errors
    tls: true,                 // Enable TLS
    family: 4,                 // Use IPv4
  };

  // Event handlers for monitoring
  mongoose.connection.on("connected", () => {
    _connected = true;
    console.log("[mongo] connected successfully");
  });

  mongoose.connection.on("error", (err) => {
    console.error("[mongo] connection error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    _connected = false;
    console.warn("[mongo] disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    _connected = true;
    console.log("[mongo] reconnected");
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("[mongo] closing connection...");
    await mongoose.connection.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("[mongo] closing connection...");
    await mongoose.connection.close();
    process.exit(0);
  });

  try {
    await mongoose.connect(env.MONGO_URI, options);
    console.log(`[mongo] connected: ${env.MONGO_URI.replace(/\/\/.*@/, "//***@")}`);
  } catch (err) {
    console.error("[mongo] initial connection failed:", err.message);
    throw err;
  }
}

export function isConnected() {
  return _connected && mongoose.connection.readyState === 1;
}

export async function disconnectMongo() {
  if (_connected) {
    await mongoose.connection.close();
    _connected = false;
    console.log("[mongo] connection closed");
  }
}